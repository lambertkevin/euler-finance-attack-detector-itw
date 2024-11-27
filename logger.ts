import chalk from 'chalk';
import { getTokenName, isContract } from './cache';
import { Call } from './types';
import {
  APPROVAL_EVENT_TOPIC,
  ERC20Interface,
  getLabel,
  TRANSFER_EVENT_TOPIC,
} from './const';

export const colorOpCode = (opCode: Call['type']) => {
  switch (opCode) {
    case 'CALL':
      return chalk.bgYellow.black(opCode);
    case 'STATICCALL':
      return chalk.bgGray.black(opCode);
    case 'DELEGATECALL':
      return chalk.bgMagenta.black(opCode);
    case 'CREATE':
      return chalk.bgCyan.black(opCode);
    case 'CREATE2':
      return chalk.bgCyan.black(opCode);
    default:
      return chalk.bgWhite.black(opCode);
  }
};

export const colorAddress = (label: string, isSmartContract?: boolean) => {
  if (label === 'Violator' || label === 'Liquidator') {
    return chalk.bgRedBright.black(label);
  }

  if (isSmartContract === undefined) {
    return label;
  }
  return isSmartContract
    ? chalk.bgBlueBright.black(label)
    : chalk.bgGreenBright.black(label);
};

export const logTrace = async (call: Call, level = 0): Promise<string[]> => {
  const logs: string[] = [];

  logs.push(
    `${`│${chalk.dim.grey('──')}`.repeat(level)}${
      level ? '├' : '┌'
    } ${colorOpCode(call.type)} from ${
      call.from !== getLabel(call.from) ? colorAddress(getLabel(call.from)) : ''
    } (${call.from}) to ${
      call.to !== getLabel(call.to) ? colorAddress(getLabel(call.to)) : ''
    }(${call.to})`,
  );

  for (const log of call.logs || []) {
    switch (log.topics[0]) {
      case TRANSFER_EVENT_TOPIC: {
        try {
          const { from, to, value } = ERC20Interface.parseLog(log).args;
          const name = await getTokenName(log.address);
          const [fromIsContract, toIsContract] = await Promise.all([
            isContract(from),
            isContract(to),
          ]);

          logs.push(
            `${`│${chalk.dim.grey('──')}`.repeat(
              level,
            )}│  ↳ ${chalk.bold.bgWhite.black(
              `(#${log.index}) Transfer of ${name}: ${colorAddress(
                `${
                  from !== getLabel(from) ? colorAddress(getLabel(from)) : ''
                } (${from})`,
                fromIsContract,
              )} -> ${colorAddress(
                `${
                  to !== getLabel(to) ? colorAddress(getLabel(to)) : ''
                } (${to})`,
                toIsContract,
              )}: ${value}`,
            )}`,
          );
        } catch (e) {
          // continue
        }
        break;
      }
      case APPROVAL_EVENT_TOPIC: {
        try {
          const { owner, spender, value } = ERC20Interface.parseLog(log).args;
          const name = await getTokenName(log.address);

          const [ownerIsContract, spenderIsContract] = await Promise.all([
            isContract(owner),
            isContract(spender),
          ]);

          logs.push(
            `${`│${chalk.dim.grey('──')}`.repeat(
              level,
            )}│  ↳ ${chalk.bold.bgWhite.black(
              `(#${log.index}) Approval of ${name}: ${colorAddress(
                `${
                  owner !== getLabel(owner) ? colorAddress(getLabel(owner)) : ''
                } (${owner})`,
                ownerIsContract,
              )} -> ${colorAddress(
                `${
                  spender !== getLabel(spender)
                    ? colorAddress(getLabel(spender))
                    : ''
                } (${spender})`,
                spenderIsContract,
              )}: ${value}`,
            )}`,
          );
        } catch (e) {
          // continue
        }
        break;
      }
      default:
        break;
    }
  }
  if (call.calls) {
    for (const subCall of call.calls) {
      await logTrace(subCall, level + 1).then((subLogs) => {
        logs.push(...subLogs);
      });
    }
  }

  return logs;
};
