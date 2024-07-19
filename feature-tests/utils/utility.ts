const delay = (ms: number | undefined) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function timeDelayForTestEnvironment(ms = 2000) {
  console.log("Wait for endpoint operations to process");
  await delay(ms);
}

export function randomString(length: number) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export interface CurrentTimeDescriptor {
  isoString: string;
  milliseconds: number;
  seconds: number;
}
