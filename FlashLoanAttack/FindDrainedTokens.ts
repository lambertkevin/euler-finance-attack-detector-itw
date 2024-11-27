import { ethers } from 'ethers';
import { getTokenDecimals, getTokenName } from '../cache';
import { computeBeforeAfterBalances } from '../helpers';
import { DrainedTokens } from '../types';

export const findDrainedTokens = async (
  accounts: `0x${string}`[],
  tokens: `0x${string}`[],
  blockNumber: number,
): Promise<DrainedTokens> => {
  const previousBlockNumber = blockNumber - 1;
  const balancesBeforeAfterPerToken = await Promise.all(
    tokens.map((token) =>
      computeBeforeAfterBalances(token, accounts, blockNumber),
    ),
  );

  const drainedTokensRecord: DrainedTokens = {};
  for (const tokenIndex in tokens) {
    const token = tokens[tokenIndex];
    const balancesBeforeAfter = balancesBeforeAfterPerToken[tokenIndex];
    const {
      [previousBlockNumber]: balancesBefore,
      [blockNumber]: balancesAfter,
    } = balancesBeforeAfter;
    const tokenDecimals = await getTokenDecimals(token);
    const tokenName = (await getTokenName(token)) || 'UNKNOWN TOKEN';

    for (const account in balancesBefore) {
      const balanceBefore = balancesBefore[account];
      const balanceAfter = balancesAfter[account];

      if (
        !balanceBefore.isZero() &&
        !balanceBefore.eq(balanceAfter) &&
        balanceAfter.lte(1)
      ) {
        if (!drainedTokensRecord[tokenName]) {
          drainedTokensRecord[tokenName] = [];
        }
        drainedTokensRecord[tokenName].push({
          account: account as `0x${string}`,
          diff: ethers.utils.formatUnits(
            balanceAfter.sub(balanceBefore),
            tokenDecimals,
          ),
        });
      }
    }
  }

  return drainedTokensRecord;
};
