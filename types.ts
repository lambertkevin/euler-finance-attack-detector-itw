import { ethers } from 'ethers';

export type Log = {
  index: number;
  address: `0x${string}`;
  topics: `0x${string}`[];
  data: `0x${string}`;
  callPath: string;
};

export type Call = {
  from: `0x${string}`;
  gas: `0x${string}`;
  gasUsed: `0x${string}`;
  to: `0x${string}`;
  input: `0x${string}`;
  output?: `0x${string}`;
  logs?: Log[];
  calls?: Call[];
  value: `0x${string}`;
  type: 'CALL' | 'STATICCALL' | 'DELEGATECALL' | 'CREATE' | 'CREATE2';
};

export type FlatCall = Omit<Call, 'calls'> & {
  parentCall: string | null;
  calls?: string[];
};

export type MappedCall = Record<string, FlatCall>;

export type CallersAndReceivers = {
  caller: `0x${string}`;
  receiver: `0x${string}`;
  key: string;
  type: FlatCall['type'];
};

export type BlockTransactionTrace = {
  txHash: `0x${string}`;
  result: Call;
};

export type FlashLoanInfos = {
  receiver: `0x${string}`;
  token: `0x${string}`;
  tokenName: string;
  lender: `0x${string}`;
  amount: ethers.BigNumber;
  callKey: string;
  event: Log;
};

export type BorrowAndMaybeDerivative = {
  borrow: {
    borrower: `0x${string}`;
    protocol: `0x${string}`;
    value: ethers.BigNumber;
    event: Log;
  };
  value: ethers.BigNumber;
  lender: `0x${string}`;
  maybeDerivative: `0x${string}`;
  event: Log;
};

export type Liquidation = {
  derivatives: `0x${string}`[];
  borrow: BorrowAndMaybeDerivative['borrow'];
  borrower: `0x${string}`;
  liquidator: `0x${string}`;
  logs: Log[];
};

export type DrainedTokens = Record<
  string,
  {
    account: `0x${string}`;
    diff: string;
  }[]
>;

export type FlashLoanAnaylisis = {
  flashLoan?: FlashLoanInfos;
  maybeBorrows?: BorrowAndMaybeDerivative[];
  borrow?: Liquidation['borrow'];
  liquidation?: Omit<Liquidation, 'borrow'>;
  drainedTokens?: DrainedTokens;
};
