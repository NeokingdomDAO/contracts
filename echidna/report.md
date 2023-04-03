# Fuzzing with Echidna

## Purpose

The purpose of this document is to describe our effort and result with the fuzzing tool Echidna and provide reference for a future, more thorough code verification.

## Introduction

### Modes

[Echidna](https://github.com/crytic/echidna) is a smart contract fuzzing tool developed by [Trail of Bits](https://www.trailofbits.com/).

It has different modes of work, main ones being:

- Properties based: invariants are written in a separate contract and the Echidna will verify them during the fuzzing
- Assertion based: invariants are written in the code itself as assertion and Echidna will just listen to the assertion failures to understand whether the verification passed or not.

The first mode allows the fuzzing properties to be kept away from the main smart contracts, so unless assertions are already part of the official code, it's less intrusive to go with property-based fuzzing.

### Testing Surface

It is possible with echidna to unleash the fuzzer on a multicontract constellation, instructing it to fuzz all public methods of all possible contracts. Alternatively, one can deploy, along with the properties, some proxy-methods, designed to call only some of the methods of the contract under test and, as well, to limit the input scope.

For instance, if a smart contract exposes `mint(address, uint256)`, `transfer(address, uint256)` and `burn(uint256)`, one could limit the scope of the test exposing only methods that could likely be misused by the public (such as `transfer`) and by forcing instructing echidna to limit the search only for `uint8` values.

Given that the role of a fuzzer is to use all sorts of input combination to break the invariants, keeping the surface very broad at the beginning of the verification process would create long waiting times and would prevent the tester to quickly iterate on the important invariants.

For this reason, we decided to start with a limited scope test.

### Scope

In order to carry out a comprehensive test of our smart contract, we would have needed numerous weeks of work, in order to

- come up with all the invariants written in a way that Echidna could test
- focus-test each smart contract
- test the whole system (which would also need the learning and usage of additional tools like [echidna-parade](https://github.com/crytic/echidna-parade) and [etheno](https://github.com/crytic/etheno))

This was beyond the scope of our commitment, as most of this would anyway be done by the auditing firm.

Additionally, Echidna seems to have issues testing upgradable contracts. Which means that we should have changed the whole contract base to a non-upgradable one in order to have echidna tests going. This was also a show stopper, as it would have added a lot of overhead to a potential continuous testing plan.

For this reason we decided to limit the scope of the project to learn the tool, setting up the basics needed for testing and try out a few invariants, to both stress-test a couple of the most complexity-involving properties, but mainly for demonstration purposes and to have the way paved for a potential future, more thorough fuzzing-based verification.

# Setup

The two targets of our testing campaigns were:

- InternalMarket
- RedemptionController

as they carry some logic that, when misused, could harm the funds of the DAO. Additionally, they were easily testable without a great setup as they themselves don't fan-out to a lot of dependencies (`RedemptionController`, for instance, has none).

In order to test these contract we created two proxie contracts that can be found in `contracts/fuzzing`

- `InternalMarketProxy.sol`
- `RedemptionControllerProxy.sol`

Additionally, we create a `TokenMock` to mock the dependency of `InternalMarket`.

In both proxies we have limited the scope of the test to only what was needed for the invariant put in in place.

Note: invariant methods are always prefixed with `echidna_`, which instructs Echidna to use these for verification.

2 invariants have been tests:

- InternalMarket: the balance that the user can withdraw shall never be more than the token the user offered
- RedemptionControlller: the total redeemable balance of the user shall never be more than the total minted tokens minus the redeemed tokens

Both properties have been successfully verified.

## Config

The config simply tells echidna at which address to deploy the proxy contract. This allowed us to give the necessary grants to the proxy contract.

In a clean setup, the grants should have been given within a setup procedure outside the main smart contracts, but due to some technical issues, for the scope of this test, the granting was temporily done in the contstructors of the smart contracts themselves.

Also: both smart contracts has been made non-upgradable.

## How to run

`echidna-test contracts/fuzzing/InternalMarketProxy.sol --contract InternalMarketProxy --crytic-args "--solc-remaps @openzeppelin/=$(pwd)/node_modules/@openzeppelin/" --config echidna/config.yml`

`echidna-test contracts/fuzzing/RedemptionControllerProxy.sol --contract RedemptionControllerProxy --crytic-args "--solc-remaps @openzeppelin/=$(pwd)/node_modules/@openzeppelin/" --config echidna/config.yml`
