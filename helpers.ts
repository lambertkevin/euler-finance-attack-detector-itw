import { ethers, logger } from 'ethers';
import { Call, CallersAndReceivers, FlatCall, Log, MappedCall } from './types';
import { isERC20Contract } from './cache';
import {
  APPROVAL_EVENT_TOPIC,
  ERC20Interface,
  provider,
  TRANSFER_EVENT_TOPIC,
} from './const';

/**
 * Unexported from ethers.js
 */
export function parseParams(
  value: string,
  allowIndex: boolean = true,
): Array<ethers.utils.ParamType> {
  return splitNesting(value).map((param) => {
    return ethers.utils.ParamType.fromString(param, allowIndex);
  });
}

/**
 * Unexported from ethers.js
 */
function splitNesting(value: string): Array<any> {
  value = value.trim();

  const result: string[] = [];
  let accum = '';
  let depth = 0;
  for (let offset = 0; offset < value.length; offset++) {
    const c = value[offset];
    if (c === ',' && depth === 0) {
      result.push(accum);
      accum = '';
    } else {
      accum += c;
      if (c === '(') {
        depth++;
      } else if (c === ')') {
        depth--;
        if (depth === -1) {
          logger.throwArgumentError('unbalanced parenthesis', 'value', value);
        }
      }
    }
  }
  if (accum) {
    result.push(accum);
  }

  return result;
}

export const keccak = (data: Buffer) => data.toString('ascii');

export const getParent = (
  mappedCall: MappedCall,
  key: string,
  ignoreDelegateCall = false,
): FlatCall | undefined => {
  if (!mappedCall[key].parentCall) return;

  const parentCallKey = mappedCall[key].parentCall as keyof typeof mappedCall;
  const parent = mappedCall[parentCallKey];

  if (ignoreDelegateCall && parent.type === 'DELEGATECALL') {
    return getParent(mappedCall, parentCallKey, ignoreDelegateCall);
  }

  return parent;
};

export const getParentCallersAndReceivers = (
  mappedCall: MappedCall,
  key: string,
  ignoreDelegateCall = false,
): CallersAndReceivers[] => {
  const call = mappedCall[key];
  if (!call?.parentCall) return [];

  const parent = getParent(mappedCall, key, ignoreDelegateCall);
  if (!parent) return [];

  const parentCallers: CallersAndReceivers[] = [];
  parentCallers.push({
    caller: parent.from,
    receiver: parent.to,
    key: call.parentCall,
    type: parent.type,
  });

  if (call.parentCall) {
    parentCallers.push(
      ...getParentCallersAndReceivers(
        mappedCall,
        call.parentCall,
        ignoreDelegateCall,
      ),
    );
  }
  return parentCallers;
};

export const getMappedCalls = (
  call: Call,
  parentCall: string | null = null,
  index = 0,
  previousMap: MappedCall = {},
): MappedCall => {
  const key = parentCall ? `${parentCall}.calls[${index}]` : 'root';
  let mappedCall = {
    ...previousMap,
    [keccak(Buffer.from(key))]: {
      ...call,
      parentCall: parentCall ? keccak(Buffer.from(parentCall)) : null,
      calls: call.calls?.map((call, i) =>
        keccak(Buffer.from(`${key}.calls[${i}]`)),
      ),
    },
  };

  for (let i = 0; i < (call?.calls?.length || 0); i++) {
    const subCall = call?.calls?.[i];
    if (!subCall) continue;

    const subCallsMap = getMappedCalls(subCall, key, i, mappedCall);
    mappedCall = {
      ...mappedCall,
      ...subCallsMap,
    };
  }

  return mappedCall;
};

export const getAllLogs = (mappedCall: MappedCall): Log[] => {
  return Object.entries(mappedCall)
    .map(
      ([key, call]) =>
        call.logs?.map((log) => ({ ...log, callPath: key })) || [],
    )
    .flat();
};

export const getLogsFromCall = (
  mappedCall: MappedCall,
  callKey: string,
): Log[] => {
  const logs: Log[] = [];
  const call = mappedCall[callKey];
  if (!call) return logs;

  if (call.logs) {
    logs.push(...call.logs);
  }

  if (!call.calls) return logs;

  for (const subCallKey of call.calls) {
    logs.push(...getLogsFromCall(mappedCall, subCallKey));
  }
  return logs;
};

export const getERC20TransferEvents = async (logs: Log[]): Promise<Log[]> => {
  const transferEvents = logs.filter(
    ({ topics }) => topics[0] === TRANSFER_EVENT_TOPIC,
  );
  if (!transferEvents.length) return [];

  return Promise.all(
    transferEvents.map(async (event) => {
      const isERC20 = await isERC20Contract(event.address);
      return isERC20 ? event : undefined;
    }),
  ).then((events) => events.filter((e): e is Log => !!e));
};

export const getERC20ApprovalEvents = async (logs: Log[]): Promise<Log[]> => {
  const transferEvents = logs.filter(
    ({ topics }) => topics[0] === APPROVAL_EVENT_TOPIC,
  );
  if (!transferEvents.length) return [];

  return Promise.all(
    transferEvents.map(async (event) => {
      const isERC20 = await isERC20Contract(event.address);
      return isERC20 ? event : undefined;
    }),
  ).then((events) => events.filter((e): e is Log => !!e));
};

export const computeTheorticalBalances = (
  tokens: `0x${string}`[],
  accounts: `0x${string}`[],
  transferEvents: Log[],
  maxEventIndex = Infinity,
): Record<string, Record<string, ethers.BigNumber>> => {
  // balances per user per token
  const balances: Record<string, Record<string, ethers.BigNumber>> = {};

  for (const account of accounts) {
    if (!balances[account]) {
      balances[account] = {};
    }

    for (const token of tokens) {
      if (!balances[account][token]) {
        balances[account][token] = ethers.constants.Zero;
      }
    }
  }

  for (const event of transferEvents) {
    if (event.index > maxEventIndex) break;

    const { from, to, value } = ERC20Interface.parseLog(event).args;
    const tokenAddress = event.address.toLowerCase() as `0x${string}`;
    if (tokens.includes(tokenAddress)) {
      if (accounts.includes(from.toLowerCase())) {
        balances[from.toLowerCase()][tokenAddress] =
          balances[from.toLowerCase()][tokenAddress].sub(value);
      }
      if (accounts.includes(to.toLowerCase())) {
        balances[to.toLowerCase()][tokenAddress] =
          balances[to.toLowerCase()][tokenAddress].add(value);
      }
    }
  }

  return balances;
};

export const computeBeforeAfterBalances = async (
  token: `0x${string}`,
  accounts: `0x${string}`[],
  blockNumber: number,
): Promise<Record<number, Record<`0x${string}`, ethers.BigNumber>>> => {
  const prevBlockNumber = blockNumber - 1;
  const balancesPerAccount = await Promise.all(
    accounts.map(async (account) =>
      Promise.all([
        provider.call(
          {
            to: token,
            data: ERC20Interface.encodeFunctionData('balanceOf', [account]),
          },
          prevBlockNumber,
        ),
        provider.call(
          {
            to: token,
            data: ERC20Interface.encodeFunctionData('balanceOf', [account]),
          },
          blockNumber,
        ),
      ]).then((res) =>
        res.map(
          (balance) =>
            ethers.utils.defaultAbiCoder.decode(['uint256'], balance)[0],
        ),
      ),
    ),
  );

  const balances: Record<number, Record<`0x${string}`, ethers.BigNumber>> = {
    [prevBlockNumber]: {},
    [blockNumber]: {},
  };
  for (const accountIndex in accounts) {
    const account = accounts[accountIndex];
    balances[prevBlockNumber][account] = balancesPerAccount[accountIndex][0];
    balances[blockNumber][account] = balancesPerAccount[accountIndex][1];
  }

  return balances;
};
