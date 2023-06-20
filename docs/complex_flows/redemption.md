# Voting and Delegation

## 1 Abstract

This document elaborates the logic behind the redemption process of Neokingdom DAO.

## 2 Motivation

What makes Neokingdom DAO unique, is the ability for its contributors to redeem the tokens they earn with fiat money, so to be able to pay their bills.

This procedure is fully automated, but it is constrained by the rules of the AoA.

## Specification

### 3.1 Rules

The rules are as follow:

- Only tokens that have been minted during the last 3 months from the last mint
- Tokens can be redeemed only 60 days after they have been offered to the other DAO contributors
- Tokens can be redeemed for 10 days
- Tokens minted more than 15 months ago cannot be redeemed
- Only tokens transferred to the Internal Market vault can be redeemed (automatically done upon offering)
- Only tokens in the "unlocked" state can be redeemed (aka: on offer for at least 7 days)

A month is defined as 30 days.

### 3.2 Redemption

#### 3.2.1 Immediate redemption

Preconditions

- Alice has no tokens

Flow:

- DAO mints 5 tokens to Alice
- Alice immediately offers 5 tokens to the contributors
- No one buys the tokens
- 60 days pass
- Alice redeems 5 tokens

#### 3.2.2 Accumulated tokens

Preconditions

- Alice has 25 tokens minted to her 1 month ago
- Alice has 50 tokens minted to her 2 months ago

Flow

- The DAO mints 10 tokens to Alice
- Alice offers 80 tokens to the DAO contributors
- No one buys the tokens
- 60 days pass
- Alice redeems 80 tokens
- Alice still owns 5 tokens

#### 3.2.3 Expired tokens

Preconditions

- Alice has 25 tokens minted to her 2 month ago
- Alice has 50 tokens minted to her 3 months ago

Flow

- One month passes
- The DAO mints 10 tokens to Alice
- Alice offers 80 tokens to the DAO contributors
- No one buys the tokens
- 60 days pass
- Alice can redeem 35 tokens, has the other 50 expired after the last mint

#### 3.2.3 Back and forth

Preconditions

- Alice has 25 tokens minted to her 2 month ago

Flow

- The DAO mints 10 tokens to Alice
- Alice offers 35 tokens to the DAO contributors
- Bob buys 5 tokens
- 60 days pass
- Alice can redeem 35 tokens, but only has 30 in the vault
- Carl transfers 5 tokens to Alice
- Alice offers the tokens
- 7 days pass without buyers
- Alice can now redeem 35 tokens

#### 3.2.3 15 months expiration

Preconditions

- Alice has 25 tokens minted to her 14 months ago
- Alice has 10 tokens minted to her 15 months ago

Flow

- Alice offers 35 tokens to the DAO contributors
- 60 days pass
- Alice can redeem 25 tokens

#### 3.2.3 10 days redemption window

Preconditions

- Alice has no tokens

Flow:

- DAO mints 5 tokens to Alice
- Alice immediately offers 5 tokens to the contributors
- No one buys the tokens
- 70 days pass
- Alice can redeem 0 tokens

## 4 Rationale

The logic has been modelled as described mainly to match the requirements of the AoA.

## 5 Implementation

Implementation can be found in `RedemptionController.sol`, which contains the base logic, and in `InternalMarket.sol`, which invokes the hooks necessary for the correct functioning of the redemption logic.

All scenarios are tested in `RedemptionController.ts` and in the integration tests, specifically:

- `redemption edge cases` and `match offer, move to external wallet, redeem when ready` in `Integration.ts`.
- `IntegrationInternalMarketRedemptionController.ts`

## 6 Copyright

<!--All TIPs MUST be released to the public domain.-->

Copyright and related rights waived via
[CC0](https://creativecommons.org/publicdomain/zero/1.0/)
