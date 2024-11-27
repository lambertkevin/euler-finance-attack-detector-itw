import { getParentCallersAndReceivers } from '../helpers';
import { ERC20Interface } from '../const';
import { isContract } from '../cache';
import {
  BorrowAndMaybeDerivative,
  FlashLoanInfos,
  MappedCall,
  Log,
} from '../types';

/**
  Borrow:
    1 - A (Violator) approves B (Euler) on asset ß
    2 - A calls C (xDAI) ->
    3 -	  C calls B to transfer ß from A to B ? 
    4 -	  C calls D to transfer ß' from BURN to A

  Detect Borrow:
    - Loop on CALL/DCALL until:
      -> CALL should contain an APPROVAL event from A to an address with code (1) on asset ß 
      -> CALL could contain a TRANSFER event on asset ß from A to address with code ? (3)
      -> CALL should contain a TRANSFER event on asset ß' from D to A or address with code from (3) (4)
 */
export const findBorrows = async (
  mappedCall: MappedCall,
  flashLoanInfos: FlashLoanInfos,
  ERC20TransferEvents: Log[],
  ERC20ApprovalEvents: Log[],
): Promise<BorrowAndMaybeDerivative[] | undefined> => {
  const {
    token: loanedToken,
    receiver: loanReceiver,
    event: loanEvent,
  } = flashLoanInfos;

  const loanedTokenApprovalEvents = ERC20ApprovalEvents.filter(
    (event) => event.address === loanedToken,
  );
  if (!loanedTokenApprovalEvents.length) return;

  // CALL could contain a TRANSFER event on asset ß from A to address with code ? (3)
  const maybeBorrowers = [{ address: loanReceiver, event: loanEvent }];
  const loanedTokenTransferEvents = ERC20TransferEvents.filter(
    (event) => event.address === loanedToken,
  );
  for (const event of loanedTokenTransferEvents) {
    const { from, to } = ERC20Interface.parseLog(event).args;
    if (from.toLowerCase() === loanReceiver.toLowerCase()) {
      const maybeBorrowerIsContract = await isContract(to);
      if (maybeBorrowerIsContract) {
        maybeBorrowers.push({
          address: to.toLowerCase(),
          event,
        });
      }
    }
  }

  // CALL should contain an APPROVAL event from A to an address with code (1) on asset ß
  const maybeBorrows: BorrowAndMaybeDerivative['borrow'][] = [];
  for (const event of loanedTokenApprovalEvents) {
    const { owner, spender } = ERC20Interface.parseLog(event).args;

    const maybeBorrower = maybeBorrowers.find(
      ({ address }) => address == owner.toLowerCase(),
    );
    if (maybeBorrower) {
      const spenderIsContract = await isContract(spender);
      if (spenderIsContract) {
        maybeBorrows.push({
          borrower: owner.toLowerCase(),
          protocol: spender.toLowerCase(),
          value: ERC20Interface.parseLog(maybeBorrower.event).args.value,
          event: maybeBorrower.event,
        });
      }
    }
  }
  if (!maybeBorrows.length) return;

  // Find the potential derivative asset
  // CALL should contain a TRANSFER event on asset ß' from D to A or address with code from (3) (4)
  const maybeDerivativeLends: BorrowAndMaybeDerivative[] = [];
  for (const event of ERC20TransferEvents) {
    if (event.address === loanedToken) continue;
    const { from, to, value } = ERC20Interface.parseLog(event).args;
    for (const maybeBorrow of maybeBorrows) {
      if (
        maybeBorrow.borrower === to.toLowerCase() &&
        maybeBorrow.event.index < event.index
      ) {
        const parentCallers = getParentCallersAndReceivers(
          mappedCall,
          event.callPath,
        ).map(({ caller }) => caller);

        if (parentCallers.includes(maybeBorrow.protocol)) {
          maybeDerivativeLends.push({
            borrow: maybeBorrow,
            lender: from.toLowerCase(),
            value,
            maybeDerivative: event.address,
            event,
          });
          break;
        }
      }
    }
  }

  return maybeDerivativeLends;
};
