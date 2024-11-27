import express from 'express';
import bodyParser from 'body-parser';
import { Promise as BlueBirdPromise } from 'bluebird';
import { detectFlashLoanAttack } from './FlashLoanAttack';
import { getBlockTraces, getTransactionTraces } from './cache';
import { FlashLoanAnaylisis } from './types';
import { ethers } from 'ethers';
import { provider } from './const';
import { logTrace } from './logger';

const app = express();
const port = 3000;

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.post('/analyze-block', async (req, res) => {
  const { blockNumber } = req.body;

  if (blockNumber === undefined || typeof blockNumber !== 'number') {
    res.status(400).send('Invalid block number');
    return;
  }
  console.log('Requesting block number: ', blockNumber);

  const blockTraces = await getBlockTraces(blockNumber);
  const analysisPerTransaction = await BlueBirdPromise.map(
    blockTraces,
    async (transaction) => {
      console.time(transaction.txHash);
      const transactionAnalysis = await detectFlashLoanAttack(
        transaction.result,
        blockNumber,
      );
      console.timeEnd(transaction.txHash);
      return { [transaction.txHash]: transactionAnalysis };
    },
    { concurrency: 3 },
  ).reduce(
    (acc, curr) => ({
      ...acc,
      ...curr,
    }),
    {} as Record<string, FlashLoanAnaylisis | undefined>,
  );

  if (!Object.keys(analysisPerTransaction).length) {
    res.send([]);
    return;
  }

  const analysisEntries = Object.entries(analysisPerTransaction);
  const presenceOfAttack = analysisEntries.some(
    ([, analysis]) =>
      !!analysis?.flashLoan && !!analysis?.borrow && !!analysis?.liquidation,
  );

  res.send({
    blockNumber,
    presenceOfAttack,
    suspectTransactions: analysisEntries
      .map(([txHash, analysis]) => {
        const isFlashLoan = !!analysis?.flashLoan;
        if (!isFlashLoan) return;

        const hasSelfLiquidation =
          !!analysis?.borrow && !!analysis?.liquidation;
        const victims = analysis!.drainedTokens
          ? Object.entries(analysis!.drainedTokens).flatMap(
              ([token, records]) =>
                records.map((record) => ({
                  ...record,
                  token,
                })),
            )
          : null;

        return {
          txHash,
          isFlashLoan,
          anaylisis: {
            selfLiquidation: hasSelfLiquidation,
            ...(hasSelfLiquidation
              ? { attacker: analysis.liquidation!.borrower }
              : {}),
            ...(victims ? { victims } : {}),
          },
        };
      })
      .filter(Boolean),
  });
});

app.post('/analyze-transaction', async (req, res) => {
  const { txHash } = req.body;

  if (txHash === undefined || !ethers.utils.isHexString(txHash)) {
    res.status(400).send('Invalid transaction hash');
    return;
  }
  console.log('Requesting transaction hash: ', txHash);
  console.time(txHash);
  const [{ blockNumber }, transactionTraces] = await Promise.all([
    provider.getTransaction(txHash),
    getTransactionTraces(txHash),
  ]);
  if (!transactionTraces || !blockNumber) {
    res.status(404).send('Transaction not found');
    return;
  }

  // await logTrace(transactionTraces).then((logs) =>
  //   console.log(
  //     logs
  //       .map(
  //         (v, i) =>
  //           `${i.toString().padStart(logs.length.toString().length, '0')} ${v}`,
  //       )
  //       .join('\n'),
  //   ),
  // );

  const analysis = await detectFlashLoanAttack(transactionTraces, blockNumber);
  console.timeEnd(txHash);

  const isFlashLoan = !!analysis?.flashLoan;
  if (!isFlashLoan) return;

  const hasSelfLiquidation = !!analysis?.borrow && !!analysis?.liquidation;
  const victims = analysis!.drainedTokens
    ? Object.entries(analysis!.drainedTokens).flatMap(([token, records]) =>
        records.map((record) => ({
          ...record,
          token,
        })),
      )
    : null;

  res.send({
    blockNumber,
    isFlashLoan,
    anaylisis: {
      selfLiquidation: hasSelfLiquidation,
      ...(hasSelfLiquidation
        ? { attacker: analysis.liquidation!.borrower }
        : {}),
      ...(victims ? { victims } : {}),
    },
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
