import { ethers } from 'ethers';
import { functionArguments, functionSelectors } from 'evmole';
import { getContractCode, getTokenName, isContract } from '../cache';
import { FlashLoanInfos, Log, MappedCall } from '../types';
import { ERC20Interface } from '../const';
import {
  getParent,
  getParentCallersAndReceivers,
  parseParams,
} from '../helpers';

/**
Flash Loan: 
	0 - A deploys B -> 
	1 -	B calls C (Lender) -> 
	2 -		C (Lender) transfers asset ß to B
	3 -		C (Lender) calls B
	4 -			B execute action
	5 -			B transfer ß back to C

Detect Flash Loan:	
  - Loop on CALL/DCALL until
      -> msg.sender or loan recipient should call a smart contract (1)
      -> CALL should contain a TRANSFER event of asset ß where receiver is msg.sender, amount is æ, and sender is Lender (2)		
      -> msg.sender should have code (3)
      -> child CALL should go to msg.sender (3)
      -> child CALL should contain a TRANSFER event of asset ß where receiver is Lender and amount is >= æ (5)
 */
export const findFlashLoan = async (
  mappedCall: MappedCall,
  transferEvents: Log[],
): Promise<FlashLoanInfos | undefined> => {
  // CALL should contain a TRANSFER event of asset ß where receiver is msg.sender, amount is æ, and sender is Lender (2)
  if (!transferEvents.length) return;

  const analyzeCall = async (
    callKey: string,
  ): Promise<FlashLoanInfos | undefined> => {
    const call = mappedCall[callKey];
    const { from: msgSender, to: msgReceiver, calls } = call;

    const subCallRecursion = async () => {
      for (const subCallKey of calls || []) {
        const flashLoanInfos = await analyzeCall(subCallKey).catch(
          console.error,
        );
        if (flashLoanInfos) return flashLoanInfos;
      }
    };
    // Should have subcalls
    if (!calls?.length) return;

    // Should be an interaction with a smart contract somehow
    const hasCalldata = call.input !== '0x';
    if (!hasCalldata) return subCallRecursion();

    // Should be calling a smart contract
    const isMsgReceiverContract = await isContract(msgReceiver);
    if (!isMsgReceiverContract) return subCallRecursion();
    const msgReceiverContractCode = await getContractCode(msgReceiver);

    // Getting the parameters in the calldata to find a potential flash loan receiver
    const selector = call.input.slice(2, 10);
    const abiEncodedData = '0x' + call.input.slice(10);

    // Handling potential proxy
    let msgReceiverImplemContractCode: string = '';
    const receiverSelectors = functionSelectors(msgReceiverContractCode, 0);
    if (!receiverSelectors.includes(selector)) {
      const delegatedReceiverKey = calls.find(
        (c) =>
          mappedCall[c] &&
          mappedCall[c].from === msgReceiver &&
          mappedCall[c].input === call.input &&
          mappedCall[c].type === 'DELEGATECALL',
      );
      if (delegatedReceiverKey) {
        const delegatedReceiver = mappedCall[delegatedReceiverKey];
        msgReceiverImplemContractCode = delegatedReceiver
          ? await getContractCode(delegatedReceiver.to)
          : '';
      }
    }

    let calldataParamsTypes, calldataParams;
    try {
      calldataParamsTypes = parseParams(
        functionArguments(
          msgReceiverImplemContractCode || msgReceiverContractCode,
          selector,
          0,
        ),
      );
      calldataParams = ethers.utils.defaultAbiCoder.decode(
        calldataParamsTypes,
        abiEncodedData,
        true,
      );
      // This should trigger an error when wrongly decoded
      calldataParams.forEach((param) => param.toString());
    } catch (e) {
      calldataParamsTypes = [];
      calldataParams = [];
    }

    // Adding any address to the potential borrowers
    const maybeBorrowerAddresses: `0x${string}`[] = isMsgReceiverContract
      ? [msgSender.toLowerCase() as `0x${string}`]
      : [];
    for (let i = 0; i < calldataParamsTypes.length; i++) {
      const paramType = calldataParamsTypes[i];
      if (paramType.type === 'address') {
        maybeBorrowerAddresses.push(calldataParams[i].toLowerCase());
      } else if (paramType.type === 'address[]') {
        maybeBorrowerAddresses.push(
          ...calldataParams[i].map((a) => a.toLowerCase()),
        );
      }
    }

    const maybeBorrowers = await Promise.all(
      Array.from(new Set(maybeBorrowerAddresses)).filter(isContract),
    );
    if (!maybeBorrowers.length) return subCallRecursion();

    // msgReceiver should send an ERC20 token to msg.sender directly or through a child call
    const lendingInfos: Array<FlashLoanInfos> = [];
    for (const event of transferEvents) {
      const { from, to, value } = ERC20Interface.parseLog(event).args;
      for (const maybeBorrower of maybeBorrowers) {
        if (to.toLowerCase() === maybeBorrower.toLowerCase()) {
          const borrowerCall =
            mappedCall[event.callPath].type === 'DELEGATECALL'
              ? getParent(mappedCall, event.callPath, true)
              : mappedCall[event.callPath];
          if (!borrowerCall) continue;

          const tokenName = (await getTokenName(event.address)) || 'UNKNOWN';
          lendingInfos.push({
            receiver: to,
            token: event.address,
            tokenName,
            lender: from,
            amount: value,
            callKey: event.callPath,
            event,
          });
          break;
        }
      }
    }
    if (!lendingInfos.length) return subCallRecursion();
    for (const lendingInfo of lendingInfos) {
      // Find the callback from the flashloan lender to the original msg.sender
      const parentCallers = getParentCallersAndReceivers(
        mappedCall,
        lendingInfo.callKey,
      );

      let flashLoanCallbackCall;
      for (const parentCaller of parentCallers) {
        const { calls: subCalls } = mappedCall[parentCaller.key];
        for (const subCallKey of subCalls || []) {
          const subCall = mappedCall[subCallKey];
          if (subCall.to.toLowerCase() === lendingInfo.receiver.toLowerCase()) {
            flashLoanCallbackCall = subCallKey;
            break;
          }
        }
      }
      if (!flashLoanCallbackCall) return subCallRecursion();

      // Find a repayment of the flashloan after the initial transfer
      let lenderHasBeenRepaid = false;
      for (const event of transferEvents) {
        const { from, to, value } = ERC20Interface.parseLog(event).args;
        if (
          event.index > lendingInfo.event.index &&
          event.address === lendingInfo.token &&
          from.toLowerCase() === lendingInfo.receiver.toLowerCase() &&
          to.toLowerCase() === lendingInfo.lender.toLowerCase() &&
          (value as ethers.BigNumber).gte(lendingInfo.amount)
        ) {
          lenderHasBeenRepaid = true;
          break;
        }
      }
      if (!lenderHasBeenRepaid) return subCallRecursion();

      return lendingInfo;
    }

    return subCallRecursion();
  };

  return analyzeCall('root');
};
