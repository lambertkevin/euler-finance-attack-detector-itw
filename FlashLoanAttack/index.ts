import { findDrainedTokens } from './FindDrainedTokens';
import { findLiquidation } from './FindLiquidation';
import { Call, FlashLoanAnaylisis } from '../types';
import { findFlashLoan } from './FindFlashLoan';
import { findBorrows } from './FindBorrows';
import {
  getAllLogs,
  getERC20ApprovalEvents,
  getERC20TransferEvents,
  getMappedCalls,
} from '../helpers';

export const detectFlashLoanAttack = async (
  call: Call,
  blockNumber: number,
): Promise<FlashLoanAnaylisis | undefined> => {
  const mappedCall = getMappedCalls(call);
  const logs = getAllLogs(mappedCall);
  const ERC20TransferEvents = await getERC20TransferEvents(logs);

  const flashLoan = await findFlashLoan(mappedCall, ERC20TransferEvents);
  if (!flashLoan) return;

  const ERC20ApprovalEvents = await getERC20ApprovalEvents(logs);
  const maybeBorrows = await findBorrows(
    mappedCall,
    flashLoan,
    ERC20TransferEvents,
    ERC20ApprovalEvents,
  );
  if (!maybeBorrows?.length) return { flashLoan };

  const liquidationInfos = await findLiquidation(
    mappedCall,
    maybeBorrows,
    ERC20TransferEvents,
  );
  if (!liquidationInfos) return { flashLoan, maybeBorrows };

  const { borrow, ...liquidation } = liquidationInfos;
  const accountsMonitored = Array.from(
    new Set([
      flashLoan.receiver,
      flashLoan.lender,
      borrow.protocol,
      borrow.borrower,
      liquidation.borrower,
      liquidation.liquidator,
    ]),
  );
  const tokensMonitored: `0x${string}`[] = Array.from(
    new Set(ERC20TransferEvents.map((event) => event.address)),
  );

  const drainedTokens = await findDrainedTokens(
    accountsMonitored,
    tokensMonitored,
    blockNumber,
  );

  return {
    flashLoan,
    borrow,
    liquidation,
    drainedTokens,
  };
};
