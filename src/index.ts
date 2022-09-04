import dotenv from "dotenv";
import fs from "fs";
import * as web3 from "@solana/web3.js";
dotenv.config();

const txLink = (signature: string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

function getKeyPair(): web3.Keypair {
  const secretKey = JSON.parse(process.env.SECRET_KEY ?? "") as number[];
  return web3.Keypair.fromSecretKey(new Uint8Array(secretKey));
} 

async function getSigner(): Promise<web3.PublicKey> {
  if (!process.env.SECRET_KEY) {
    const keypair = web3.Keypair.generate();

    fs.writeFileSync('.env', `SECRET_KEY=[${keypair.secretKey}]`);
    return keypair.publicKey;
  }

  return getKeyPair().publicKey;
}

async function requestSOL(account: web3.PublicKey, connection: web3.Connection) {
  const balance = await connection.getBalance(account);

  if (balance == 0 || balance / web3.LAMPORTS_PER_SOL < 1) {
    console.log('Requesting airdrop ...');
    const signature = await connection.requestAirdrop(account, web3.LAMPORTS_PER_SOL);
    console.log(`Airdrop successful ${txLink(signature)}`);
  }
}

async function sendSOL(from: web3.PublicKey, to: web3.PublicKey, connection: web3.Connection) {
  const tx = new web3.Transaction().add(
    web3.SystemProgram.transfer({
      fromPubkey: from,
      lamports: 0.3 * web3.LAMPORTS_PER_SOL,
      toPubkey: to
    })
  );
  
  const signature = await connection.sendTransaction(tx, [getKeyPair()]);
  const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
  
  await connection.confirmTransaction({signature, blockhash, lastValidBlockHeight});
  console.log('Sent', txLink(signature));
}

async function main() {
  const conn = new web3.Connection(web3.clusterApiUrl('devnet'));

  const signer = await getSigner();
  console.log(signer.toBase58());
  requestSOL(signer, conn);

  try {
    const receiverPk = new web3.PublicKey(process.env.RECEIVER ?? "");
    await sendSOL(signer, receiverPk, conn);
  } catch (err) {
    console.error(err);
  }

}

main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
