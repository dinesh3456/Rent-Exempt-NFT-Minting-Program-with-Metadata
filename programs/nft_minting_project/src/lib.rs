use {
    anchor_lang::{
        prelude::*,
        solana_program::program::invoke_signed,
    },
    anchor_spl::{
        token::{Mint, Token, TokenAccount},
        associated_token::AssociatedToken,
        metadata::{
            create_metadata_accounts_v3,
            update_metadata_accounts_v2,
            mpl_token_metadata,
        },
    },
};

// Import the ID directly from mpl_token_metadata
use anchor_spl::metadata::mpl_token_metadata::ID as MetadataTokenId;

declare_id!("FHPZSYygxX52f3op5TndwoN5Cadyixu4zTc2g13HAasP");

#[program]
pub mod nft_minting_project {
    use super::*;

    // Method is defined as mint_nft in snake_case
    // This will be available as mintNft in the TypeScript client
    pub fn mint_nft(
        ctx: Context<MintNFT>,
        name: String,
        symbol: String,
        uri: String,
        seller_fee_basis_points: u16,
    ) -> Result<()> {
        msg!("NFT Minting: Creating metadata account...");
        
        // Create mint account
        let seeds = &["mint-authority".as_bytes(), &[ctx.bumps.mint_authority]];
        let signer = &[&seeds[..]];

        // Create metadata account instruction using anchor_spl's metadata feature
        let creator = vec![mpl_token_metadata::types::Creator {
            address: ctx.accounts.mint_authority.key(),
            verified: true,
            share: 100,
        }];

        // Create metadata account
        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                anchor_spl::metadata::CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.metadata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    mint_authority: ctx.accounts.mint_authority.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    update_authority: ctx.accounts.mint_authority.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer,
            ),
            mpl_token_metadata::types::DataV2 {
                name,
                symbol,
                uri,
                seller_fee_basis_points,
                creators: Some(creator),
                collection: None,
                uses: None,
            },
            true,  // is_mutable
            true,  // update_authority_is_signer
            None,  // collection_details
        )?;

        // Mint token to the token account
        msg!("NFT Minting: Minting one token to token account...");
        anchor_spl::token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
            1, // Mint exactly 1 token (NFT)
        )?;

        // Make the metadata immutable by updating it
        msg!("NFT Minting: Making metadata immutable...");
        update_metadata_accounts_v2(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                anchor_spl::metadata::UpdateMetadataAccountsV2 {
                    metadata: ctx.accounts.metadata.to_account_info(),
                    update_authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
            None,            // New update authority
            None,            // New data
            None,            // New collection details
            Some(false),     // is_mutable = false to make immutable
        )?;

        msg!("NFT Minting: NFT created successfully!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNFT<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = mint_authority,
        mint::freeze_authority = mint_authority,
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: We're using Metaplex program to create this account
    #[account(
        mut,
        // Fix the seeds definition to use string literals
        seeds = [
            "metadata".as_bytes(), 
            token_metadata_program.key().as_ref(),
            mint.key().as_ref()
        ],
        bump,
        seeds::program = token_metadata_program.key()
    )]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        seeds = ["mint-authority".as_bytes()],
        bump,
    )]
    /// CHECK: PDA used as mint authority
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: Metaplex program ID
    /// Using a direct reference to the account instead of address constraint
    pub token_metadata_program: UncheckedAccount<'info>,
}