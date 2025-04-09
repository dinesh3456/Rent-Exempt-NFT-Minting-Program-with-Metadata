import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { NftMintingProject } from '../target/types/nft_minting_project';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress
} from '@solana/spl-token';
import { assert } from 'chai';

// Hardcoded Metaplex Program ID
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

describe('nft_minting_project', () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftMintingProject as Program<NftMintingProject>;
  const wallet = provider.wallet;
  
  it('Mints an NFT with metadata', async () => {
    // Generate a new keypair for the mint
    const mintKeypair = anchor.web3.Keypair.generate();
    console.log(`Mint address: ${mintKeypair.publicKey.toString()}`);

    // Derive PDA for mint authority
    const [mintAuthority, _mintAuthorityBump] = await PublicKey.findProgramAddress(
      [Buffer.from("mint-authority")],
      program.programId
    );
    console.log(`Mint authority PDA: ${mintAuthority.toString()}`);

    // Derive metadata account PDA manually
    const [metadataAddress] = await PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );
    console.log(`Metadata address: ${metadataAddress.toString()}`);

    // Get associated token account for the wallet
    const tokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      wallet.publicKey
    );
    console.log(`Token account: ${tokenAccount.toString()}`);

    // NFT details
    const name = "My Test NFT";
    const symbol = "TNFT";
    // Update to your pinata metadata link
    const uri = "https://gateway.pinata.cloud/ipfs/bafkreigpxkmtgyuxcfxjcib63hsrxogtbjyp2ysq7rgjuyg7hcj2mka47u";
    const sellerFeeBasisPoints = 500; // 5%

    // Mint NFT
    console.log("Minting NFT...");
    try {
      // Check available methods on the program object
      console.log("Available methods:", Object.keys(program.methods));
      
      // Debug: Print out all account names from IDL
      console.log("Account names in IDL:", 
        program.idl.instructions
          .find(i => i.name === 'mintNft')?.accounts
          .map(a => a.name)
      );
      
      // Try to mint the NFT with correct account names
      const tx = await program.methods
        .mintNft(name, symbol, uri, sellerFeeBasisPoints)
        .accounts({
          payer: wallet.publicKey,
          mint: mintKeypair.publicKey,
          metadata: metadataAddress,
          mintAuthority: mintAuthority,
          tokenAccount: tokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          tokenMetadataProgram: METADATA_PROGRAM_ID,
        })
        .signers([mintKeypair])
        .rpc();

      console.log("Transaction signature:", tx);
      console.log("NFT successfully minted!");
      console.log(`View on Solscan: https://solscan.io/token/${mintKeypair.publicKey.toString()}?cluster=devnet`);

      // Verify the token account has 1 token
      const tokenAccountInfo = await provider.connection.getTokenAccountBalance(tokenAccount);
      assert.equal(tokenAccountInfo.value.uiAmount, 1);
      assert.equal(tokenAccountInfo.value.decimals, 0);
    } catch (error) {
      console.error("Error minting NFT:", error);
      
      // Better error debugging
      if (error instanceof Error) {
        console.error(error.message);
        // Check if it's an Anchor error with logs
        if ('logs' in error) {
          console.error("Program logs:", (error as any).logs);
        }
      }
      
      // Log the IDL to debug method names and account structures
      console.log("Program IDL methods:", program.idl.instructions.map(i => i.name));
      const mintNftInstruction = program.idl.instructions.find(i => i.name === 'mintNft');
      if (mintNftInstruction) {
        console.log("mint_nft accounts:", mintNftInstruction.accounts.map(a => a.name));
      }
      
      throw error;
    }
  });
});