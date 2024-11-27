import { ethers } from 'ethers';
import { ERC20Interface, TRANSFER_EVENT_TOPIC } from '../const';
import {
  BorrowAndMaybeDerivative,
  Liquidation,
  Log,
  MappedCall,
} from '../types';
import {
  computeTheorticalBalances,
  getLogsFromCall,
  getParentCallersAndReceivers,
} from '../helpers';

/**
TRANSFER Liquidation Burn
	- emitter xDAIRouter
	- parentCallers
		- EulerProtocol Delegate -> LiquidationContract
		- EulerProtocolRouter
		- Liquidator

Detect Liquidation:
	- Loop on CALL/DCALL until:
		-> CALL should have subcalls (1)
		-> CALL should contain a TRANSFER event from A to 0 & amount æ (token ß') (2)
		-> CALL should contain a TRANSFER event from 0 to msg.sender & amount æ (token ß') (3)
		-> CALL should contain a TRANSFER event from A to msg.sender (token ß'') (4)		
    -> msg.sender or previous parent msg.sender should not have allowance on A (5)
 */
export const findLiquidation = async (
  mappedCall: MappedCall,
  borrowAndDerivatives: BorrowAndMaybeDerivative[],
  ERC20TransferEvents: Log[],
): Promise<Liquidation | undefined> => {
  const uniqueDerivatives = Array.from(
    new Set(borrowAndDerivatives.map(({ maybeDerivative }) => maybeDerivative)),
  );
  if (uniqueDerivatives.length < 2) return;

  const uniqueBorrowers = Array.from(
    new Set(borrowAndDerivatives.map(({ borrow }) => borrow.borrower)),
  );

  let liquidation:
    | {
        from: `0x${string}`;
        to: `0x${string}`;
        value: ethers.BigNumber;
        event: Log;
        borrowAndDerivative: BorrowAndMaybeDerivative;
        liquidationCall: string;
      }
    | undefined;
  for (const borrowAndDerivative of borrowAndDerivatives) {
    const {
      borrow,
      event: derivativeEvent,
      maybeDerivative: derivativeToken,
    } = borrowAndDerivative;

    for (const event of ERC20TransferEvents) {
      // for events happening after the mint of the derivative token
      if (
        event.index > derivativeEvent.index &&
        event.address === derivativeToken
      ) {
        const { from, to, value } = ERC20Interface.parseLog(event).args;
        if (
          // Token are being transferred from the borrower to somewhere else
          from.toLowerCase() === borrow.borrower.toLowerCase()
        ) {
          const parentCallers = getParentCallersAndReceivers(
            mappedCall,
            event.callPath,
          );
          const liquidatorInParentCallers = parentCallers.find(
            ({ caller }) => to.toLowerCase() === caller,
          );
          const protocolInParentCallers = parentCallers.find(
            ({ caller }) => borrow.protocol.toLowerCase() === caller,
          );
          // Check if the potential liquidator initiated the transfer
          if (liquidatorInParentCallers && protocolInParentCallers) {
            const balances = computeTheorticalBalances(
              uniqueDerivatives,
              uniqueBorrowers,
              ERC20TransferEvents,
              event.index,
            );
            // Check if the amount left in borrower's address is close to 0
            if (balances[borrow.borrower][derivativeToken].lt(10)) {
              liquidation = {
                from: from.toLowerCase() as `0x${string}`,
                to: to.toLowerCase() as `0x${string}`,
                value,
                event,
                borrowAndDerivative: borrowAndDerivative,
                liquidationCall: liquidatorInParentCallers.key,
              };
              break;
            }
          }
        }
      }
    }
  }
  if (!liquidation) return;

  const liquidationsLogs = getLogsFromCall(
    mappedCall,
    liquidation.liquidationCall,
  );
  const liquidationTransferEvents = liquidationsLogs.filter(
    (log) => log.topics[0] === TRANSFER_EVENT_TOPIC,
  );

  return {
    derivatives: Array.from(
      new Set(liquidationTransferEvents.map((log) => log.address)),
    ),
    borrow: liquidation.borrowAndDerivative.borrow,
    borrower: liquidation.borrowAndDerivative.borrow.borrower,
    liquidator: liquidation.from,
    logs: liquidationTransferEvents,
  };
};
