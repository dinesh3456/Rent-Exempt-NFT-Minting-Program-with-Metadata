import * as web3 from '@solana/web3.js';
import * as token from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// ===== Configuration =====
// Your deployed program ID
const PROGRAM_ID = new web3.PublicKey('FHPZSYygxX52f3op5TndwoN5Cadyixu4zTc2g13HAasP');
// Metaplex Token Metadata Program ID
const METADATA_PROGRAM_ID = new web3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
// Connection to Solana devnet
const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');

// Mint NFT with direct transaction construction (avoiding Anchor TypeScript issues)
async function mintNFT() {
  try {
    console.log('🚀 Starting NFT minting process...');
    
    // Load the wallet from the default keypair location
    const walletKeypair = web3.Keypair.fromSecretKey(
      Uint8Array.from(
        JSON.parse(
          fs.readFileSync(path.resolve(process.env.HOME || '', '.config/solana/id.json'), 'utf-8')
        )
      )
    );
    console.log(`👛 Using wallet: ${walletKeypair.publicKey.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log(`💰 Wallet balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);
    
    if (balance < web3.LAMPORTS_PER_SOL * 0.05) {
      console.log('⚠️ Warning: Low balance. You might need more SOL to mint an NFT.');
    }
    
    // Generate a new keypair for the mint
    const mintKeypair = web3.Keypair.generate();
    console.log(`🔑 Mint address: ${mintKeypair.publicKey.toString()}`);
    
    // Step 1: Create the token mint account
    console.log("Creating token mint account...");
    await token.createMint(
      connection,
      walletKeypair,
      walletKeypair.publicKey,  // mint authority
      walletKeypair.publicKey,  // freeze authority (you can set to null if not needed)
      0                         // decimals (0 for NFTs)
    );
    console.log("Token mint created successfully");
    
    // Step 2: Create an associated token account for the wallet
    console.log("Creating associated token account...");
    const tokenAccount = await token.createAssociatedTokenAccount(
      connection,
      walletKeypair,
      mintKeypair.publicKey,
      walletKeypair.publicKey
    );
    console.log(`Token account created: ${tokenAccount.toString()}`);
    
    // Step 3: Mint exactly 1 token (NFT)
    console.log("Minting one token...");
    await token.mintTo(
      connection,
      walletKeypair,
      mintKeypair.publicKey,
      tokenAccount,
      walletKeypair,
      1
    );
    console.log("Token minted successfully");
    
    // Step 4: Display the NFT information
    console.log("\n✅ NFT successfully created!");
    console.log(`🔑 Mint address: ${mintKeypair.publicKey.toString()}`);
    console.log(`💼 Token account: ${tokenAccount.toString()}`);
    console.log(`🌐 View on Solscan: https://solscan.io/token/${mintKeypair.publicKey.toString()}?cluster=devnet`);
    
    // Note: This simplified version doesn't attach metadata
    console.log("\n⚠️ Note: This simplified version created a token but doesn't attach metadata.");
    console.log("You would need to use the Metaplex APIs to attach metadata in a production environment.");
    
  } catch (error) {
    console.error("\n❌ Error creating NFT:");
    console.error(error);
  }
}

// Run the function
mintNFT();