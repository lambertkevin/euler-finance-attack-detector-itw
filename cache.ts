import fs from 'fs/promises';
import { BlockTransactionTrace, Call } from './types';
import { ERC20Interface, provider } from './const';
import { ethers } from 'ethers';

export const getBlockTraces = async (
  blockNumber: number,
): Promise<BlockTransactionTrace[]> => {
  try {
    const data = await fs.readFile(`./data/${blockNumber}.json`, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    const transactions = await provider.send('debug_traceBlockByNumber', [
      blockNumber,
      {
        tracer: 'callTracer',
        tracerConfig: {
          enableReturnData: false,
          enableMemory: false,
          onlyTopCall: false,
          withLog: true,
        },
      },
    ]);
    await fs.writeFile(
      `./data/${blockNumber}.json`,
      JSON.stringify(transactions, null, 2),
    );
    return transactions;
  }
};

export const getTransactionTraces = async (
  txHash: `0x${string}`,
): Promise<Call> => {
  try {
    const data = await fs.readFile(`./data/${txHash}.json`, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    const traces = await provider.send('debug_traceTransaction', [
      txHash,
      {
        tracer: 'callTracer',
        tracerConfig: {
          enableReturnData: false,
          enableMemory: false,
          onlyTopCall: false,
          withLog: true,
        },
      },
    ]);
    await fs.writeFile(
      `./data/${txHash}.json`,
      JSON.stringify(traces, null, 2),
    );
    return traces;
  }
};

const staticCache = new Map<string, string | boolean | number>();

export const getTokenName = async (
  address: `0x${string}`,
): Promise<string | undefined> => {
  const key = address + 'name';
  if (!staticCache.has(key)) {
    const name = await provider
      .call({
        to: address,
        data: ERC20Interface.encodeFunctionData('name'),
      })
      .then((res) => ethers.utils.defaultAbiCoder.decode(['string'], res)[0])
      .catch(() =>
        provider
          .call({
            to: address,
            data: ERC20Interface.encodeFunctionData('symbol'),
          })
          .then(
            (res) => ethers.utils.defaultAbiCoder.decode(['string'], res)[0],
          )
          .catch(() => 'UNKNOWN_TOKEN'),
      );
    staticCache.set(key, name);
  }
  return staticCache.get(key) as string;
};

export const getTokenDecimals = async (
  address: `0x${string}`,
): Promise<number | undefined> => {
  const key = address + 'decimals';
  if (!staticCache.has(key)) {
    const decimals = await provider
      .call({
        to: address,
        data: ERC20Interface.encodeFunctionData('decimals'),
      })
      .then((res) => ethers.utils.defaultAbiCoder.decode(['uint8'], res)[0])
      .catch(() => -1);
    staticCache.set(key, decimals);
  }
  return staticCache.get(key) as number | undefined;
};

export const getContractCode = async (
  address: `0x${string}`,
): Promise<string> => {
  const key = address + 'code';
  if (!staticCache.has(key)) {
    const code = await provider.getCode(address);
    staticCache.set(key, code);
  }
  return staticCache.get(key) as string;
};

export const isContract = async (address: `0x${string}`): Promise<boolean> => {
  const code = await getContractCode(address);
  return code !== '0x';
};

export const isERC20Contract = async (
  address: `0x${string}`,
): Promise<boolean> => {
  const decimals = await getTokenDecimals(address);
  return decimals !== -1;
};
