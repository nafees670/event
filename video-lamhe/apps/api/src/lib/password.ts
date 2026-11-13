import bcrypt from 'bcryptjs';

export const hashPassword = (password: string, rounds: number) => bcrypt.hash(password, rounds);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

let dummyHash: Promise<string> | undefined;
/** Compare against a throwaway hash so "unknown email" takes as long as "wrong password". */
export async function burnPasswordCheck(password: string, rounds: number): Promise<false> {
  dummyHash ??= bcrypt.hash('timing-equaliser-not-a-real-password', rounds);
  await bcrypt.compare(password, await dummyHash);
  return false;
}
