# How to deploy and set up the NeokingdomDAO contracts

We recommend using a multisig to operate the contracts. You can create one here https://safe.evmos.org/.

## Deploy the contracts

```
npx hardhat --network evmos deploy 
```

## Setup the contracts

```
npx hardhat --network evmos setup --admin-address <multisig>
```

## Mint the shares

Neokingdom DAO is an Estonian OÜ with an initial capital of 10,000 shares. To mint the shares:

- Open the SAFE, apps, and open the transaction builder
- In the form:
    - insert the address of the `ShareholderRegistry`
    - insert the ABI
    - in transaction information:
        - To address: the address of the `ShareholderRegistry`
        - Contract Method Selector: `mint`
        - Account: the address of the `ShareholderRegistry`
        - Amount: `10000000000000000000000`
- Execute the transaction

## Transfer the shares to the founders

- Open the SAFE, apps, and open the transaction builder
- In the form:
    - insert the address of the `ShareholderRegistry`
    - insert the ABI
    - in transaction information:
        - To address: the address of the `ShareholderRegistry`
        - Contract Method Selector: `batchTransferFromDAO`
        - Recipients: a JSON array of the receivers of the share.
- Execute the transaction

## Promote the founders to Contributors

- Open the SAFE, apps, and open the transaction builder
- In the form:
    - insert the address of the `ShareholderRegistry`
    - insert the ABI
    - in transaction information:
        - To address: the address of the `ShareholderRegistry`
        - Contract Method Selector: `setStatus`
        - Status: `0x84d5b933b93417199db826f5da9d5b1189791cb2dfd61240824c7e46b055f03d` (`keccak256(toUtf8Bytes("CONTRIBUTOR_STATUS"))`)
        - Account: the address to promote to Contributor
- Execute the transaction

## Promote to Board Member

- Open the SAFE, apps, and open the transaction builder
- In the form:
    - insert the address of the `ShareholderRegistry`
    - insert the ABI
    - in transaction information:
        - To address: the address of the `ShareholderRegistry`
        - Contract Method Selector: `setStatus`
        - Status: `0x1417f6a224499a6e3918f776fd5ff7d6d29c2d693d9862a904be8a74faad51f1` (`keccak256(toUtf8Bytes("BOARD_MEMBER_STATUS"))`)
        - Account: the address to promote to Board Member
- Execute the transaction

# Onboard new contributors

## Transfer the shares to the new contributors

- Open the SAFE, apps, and open the transaction builder
- In the form:
    - insert the address of the `ShareholderRegistry`
    - insert the ABI
    - in transaction information:
        - To address: the address of the `ShareholderRegistry`
        - Contract Method Selector: `batchTransferFromDAO`
        - Recipients: a JSON array of the receivers of the share.
- Execute the transaction

## Promote the new contributors to Contributors

- Open the SAFE, apps, and open the transaction builder
- In the form:
    - insert the address of the `ShareholderRegistry`
    - insert the ABI
    - in transaction information:
        - To address: the address of the `ShareholderRegistry`
        - Contract Method Selector: `setStatus`
        - Status: `0x84d5b933b93417199db826f5da9d5b1189791cb2dfd61240824c7e46b055f03d` (`keccak256(toUtf8Bytes("CONTRIBUTOR_STATUS"))`)
        - Account: the address to promote to Contributor
- Execute the transaction

# Pre-genesis vote

## Mint 1h of tokens to each contributor

- Open the SAFE, apps, and open the transaction builder
- In the form:
    - insert the address of the `NeokingdomToken`
    - insert the ABI
    - in transaction information:.
- Execute the transaction