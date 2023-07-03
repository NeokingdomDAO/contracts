# Voting and Delegation

## 1 Abstract

This document elaborates the logic behind the voting power distribution and delegation implemented in the Neokingdom DAO contracts.

## 2 Motivation

One of the main components of the NeokingdomDAO is the automatic voting and settlement of resolutions. The Article of Association of the DAO describes how the voting process for a resolution should be implemented. More in detail:

- it specifies on how the voting power should be distributed among token holders
- it specifies how the delegation among contributors should work

It boils down to set of rules governing the voting and delegation process. Such rules need to be implemented via a Smart Contract in order to enable to automatic execution of this part of the DAO.

## 3 Specification

### 3.1 Rules

### 3.1.1 AoA rules:

- Only Contributors can vote.
- A Contributor's voting power equals the amount of NEOKGov tokens it owns.
- A Contributor A can delegate another Contributor B, thus transferring A's voting power to B.
- A Contributor A cannot delegate another Contributor B if B already delegated someone else.
- A Contributor A cannot delegate another Contributor if A itself has already been delegated.
- When a Contributor receives new tokens from any source, its voting power increases by the transferred amount.
- The total voting power at a given time in the DAO is the sum of the voting power of the individual Contributors.
- A Contributor's voting power is calculated at the time of the resolution approval
- A Contributor's delegation can be overridden during the resolution voting, simply by casting a vote

### 3.1.2 Additional rules:

- A Contributor must first delegate itself to be able to delegate others

### 3.2 Voting

The voting power of an account changes after the following actions:

- Delegation
- Token transfer
- Removal of Contributor status

The following conditions always hold true:

- A token holder that is not a Contributor, has voting power 0
- A token holder that is a Contributor who delegated someone else, has voting power 0
- A token holder that is a Contributor who didn't delegate itself (not someone else), has voting power 0
- A token holder that is a Contributor who delegated itself and has no delegators, has voting power equal to its NEOKGov balance
- A token holder that is a Contributor who delegated itself and has 1 or more delegators, has voting power equal to its NEOKGov balance + the sum of the balance of its delegators

#### 3.2.2 Delegation use cases

Preconditions:

- Both A and B are Contributors
- A has a delegate C (who is also a Contributor)
- B has delegated itself

Flow:

1. A delegates B
2. The balance of A is added as voting power to B.
3. The balance of A is removed from the voting power of C.

---

Preconditions:

- Both A and B are Contributors
- A has delegated itself
- B has delegated itself

Flow:

1. A delegates B,
2. The balance of A is added as voting power to B.
3. The balance of A is removed from the voting power of A.

---

Preconditions:

- A is a Contributor
- A has no delegate

1. A delegates A
2. The balance of A is added as voting power to A

---

In all the following cases, delegation fails:

- A is delegating B, but A has currently no delegates
- A is delegating B, but B has currently no delegates
- A is delegating B, but B already has a delegate different from itself
- A is delegating B, but A already has a delegator different from itself
- A is delegating B, but B is not a contributor
- A is delegating B, but A is not a contributor

#### 3.2.2 Token transfer use cases

Preconditions:

- Both A and B are self-delegated Contributors

Flow:

1. A transfers 10 tokens to B.
2. The voting power of B is increased by 10.
3. The voting power of A is decreased by 10.

---

Preconditions:

- A is a Contributor

Flow:

1. The DAO mints 10 tokens to A.
2. The voting power of A increases by 10.
3. The total voting power increases by 10.

---

Preconditions:

- A is a Contributor who delegated X
- B is a Contributor who delegated Y

Flow:

1. A transfers 10 tokens to B,
2. The voting power of Y is increased by 10.
3. The voting power of X is decreased by 10.

---

Preconditions:

- A is a self-delegated Contributor
- B is not a Contributor

Flow:

1. A transfers 10 tokens to B,
2. The voting power of A is decreased by 10.
3. The total voting power is decreased by 10.

---

Preconditions:

- A is not a Contributor
- B is a self-delegated Contributor

Flow:

1. A transfers 10 tokens to B,
2. The voting power of B is increased by 10.
3. The total voting power is increased by 10.

---

In the following cases, no voting power is changed

- A is not a Contributor and sends token to B who is not a Contributor
- A has no delegate and sends token to B who has no delegate
- The DAO mints token to A who is not a Contributor
- The DAO mints token to A who has no delegate

#### 3.2.3 Removal of Contributor status

Preconditions:

- A is Contributor
- A has voting power 10

Flow:

1. The DAO removes the Contributor status from A
2. The voting power of A goes to 0
3. The total voting power is decreased by 10.

#### 3.2.4 Voting

Preconditions:

- A is a self-delegated Contributor with 10 NEOKGov (aka voting power 10)
- B is a self-delegated Contributor with 20 NEOKGov (aka voting power 20)
- Total voting power is 30
- A resolution with 50% threshold is in the voting phase

Flow:

1. A votes YES
2. B votes NO
3. Resolution voting ends
4. Resolution did not pass

---

Preconditions:

- A has 10 NEOKGov
- B has 20 NEOKGov
- B delegated A
- A voting power is 30
- B voting power is 0
- A resolution with 50% threshold is in the voting phase

Flow:

- A votes YES
- B does not vote
- Resolution voting ends
- Resolution passes

---

Preconditions:

- A has 10 NEOKGov
- B has 20 NEOKGov
- B delegated A
- A voting power is 30
- B voting power is 0
- A resolution with 50% threshold is in the voting phase

Flow:

- A votes YES
- B votes NO
- Resolution voting ends
- Resolution does not pass

## 4 Rationale

The logic has been modelled as described mainly to match the requirements of the AoA.

Additionally, the self-delegation step has been added to the rules.
The rationale behind this decision is to keep the gas cost for transfer cheaper and to simplify the logic.
Not having done this would have implied that for each token transfer, we needed to check whether the two parties involved where Contributors (calling an external contract) and then perform the due actions. By making the self-delegation mandatory, instead, we can assume that an account that has a delegate (even if it's a self-delegate) is also a Contributor, because it must have first called the `delegate` function whose access is granted only to Contributors.

This and the rest of the contract has been inspired by `ERC20Vote`, in order not to reinvent the wheel.

## 5 Implementation

Implementation can be found in `Voting.sol`, which contains the base logic, and in `VotingSnapshot.sol`, which add snapshotting capabilities to the original contract.

All scenarios are tested in `Voting.ts` and `VotingSnapshot.ts`.

## 6 Copyright

<!--All TIPs MUST be released to the public domain.-->

Copyright and related rights waived via
[CC0](https://creativecommons.org/publicdomain/zero/1.0/)
