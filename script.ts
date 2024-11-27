import { ethers } from 'ethers';
import { Promise as BlueBirdPromise } from 'bluebird';
import { getTokenDecimals, getBlockTraces } from './cache';
import { detectFlashLoanAttack } from './FlashLoanAttack';
import { logTrace } from './logger';
import { getLabel } from './const';
import chalk from 'chalk';

(async () => {
  const blockNumber = 16817996;
  // const blockNumber = 16818057;
  // const blockNumber = 16818065;
  // const blockNumber = 21258865;
  const transactions = await getBlockTraces(blockNumber);
  console.time(`Analyzing ${transactions.length} transactions`);
  await BlueBirdPromise.map(
    transactions.filter(
      ({ txHash }) =>
        txHash ===
        '0xc310a0affe2169d1f6feec1c63dbc7f7c62a887fa48795d327d4d2da2d6b111d',
    ),
    async (transaction) => {
      // await logTrace(transaction.result).then((logs) =>
      //   console.log(
      //     logs
      //       .map(
      //         (v, i) =>
      //           `${i
      //             .toString()
      //             .padStart(logs.length.toString().length, '0')} ${v}`,
      //       )
      //       .join('\n'),
      //   ),
      // );

      const perfBefore = performance.now();
      const analysis = await detectFlashLoanAttack(
        transaction.result,
        blockNumber,
      );

      const perfAfter = performance.now();
      if (analysis?.flashLoan) {
        const { flashLoan, borrow, liquidation, drainedTokens } = analysis;

        const humanReadableLogs: string[] = [
          `${(perfAfter - perfBefore).toFixed(2)}ms - ${transaction.txHash}`,
        ];

        const flashLoanTokenDecimals = await getTokenDecimals(flashLoan.token);
        humanReadableLogs.push(
          `has flash loan: ${ethers.utils.formatUnits(
            flashLoan.amount,
            flashLoanTokenDecimals,
          )} ${flashLoan.tokenName} to ${flashLoan.receiver}`,
        );

        if (borrow && liquidation) {
          humanReadableLogs.push(`🚨 Self-liquidation detected`);
        }

        if (drainedTokens) {
          humanReadableLogs.push(
            Object.entries(drainedTokens)
              .map(([tokenName, records]) =>
                records.map(
                  (record) =>
                    `\n   • ${getLabel(record.account)} lost ${chalk.bgRed(
                      record.diff,
                    )} ${tokenName}`,
                ),
              )
              .join('\n'),
          );
        }

        console.log(humanReadableLogs.join(' '));
      } else {
        console.log(
          `${(perfAfter - perfBefore).toFixed(2)}ms - ${
            transaction.txHash
          } has no flash loan`,
        );
      }
    },
    { concurrency: 3 },
  );
  console.timeEnd(`Analyzing ${transactions.length} transactions`);
})();
