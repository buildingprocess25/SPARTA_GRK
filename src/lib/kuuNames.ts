import prisma from './prisma.ts';

// KUU codes share their format with the branch codes in the store report. Unknown codes stay as codes rather than guessed names.
export async function loadKuuNames(): Promise<Record<string, string>> {
  try {
    const branches = await prisma.storeKwhMonthly.findMany({ distinct: ['branchCode'], select: { branchCode: true, branchName: true } });
    return Object.fromEntries(branches.map(branch => [branch.branchCode, branch.branchName]));
  } catch (error) {
    if (error?.code === 'P2021') return {};
    throw error;
  }
}
