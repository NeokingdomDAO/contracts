// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/AccessControl.sol";
import { Roles } from "../extensions/Roles.sol";
import "./IRedemptionController.sol";

// Redeemable tokens are decided on Offer
// - when user offers, we check how many tokens are eligible for redemption (3 months, 15 months rule)
//   and mark it as redeemable in 60 days
// - when user offers, we check how many tokens are in the vault and how many are currently redeemable. We take the redeemable amount
//   straight into the vault, the rest remains locked for 7 days
// - when 60 days pass, the token are redeemable for 10 days
//    - if the user redeems, tokens are subtracted
//    - if the user moves the tokens to the outside or to the contributor wallet, tokens are subtracted
//    - if the user forgets, the tokens are not redeemable. they can only be moved outside the vault (contributor or 2ndary)
// - when the 10 days expire
//    -

// The contract tells how many tokens are redeemable by Contributors

contract RedemptionController is IRedemptionController, AccessControl {
    uint256 public redemptionStart;
    uint256 public redemptionWindow;

    uint256 public maxDaysInThePast;
    uint256 public activityWindow;

    bytes32 public constant TOKEN_MANAGER_ROLE =
        keccak256("TOKEN_MANAGER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        grantRole(
            TOKEN_MANAGER_ROLE,
            0x00a329c0648769A73afAc7F9381E08FB43dBEA72
        );
        redemptionStart = 60 days;
        redemptionWindow = 10 days;
        maxDaysInThePast = 30 days * 15;
        activityWindow = 30 days * 3;
    }

    struct Redeemable {
        uint256 amount;
        uint256 mintTimestamp;
        uint256 start;
        uint256 end;
    }

    // TODO: improve naming to indicate that this is more than just MINT
    struct MintBudget {
        uint256 timestamp;
        uint256 amount;
    }

    mapping(address => Redeemable[]) internal _redeemables;
    mapping(address => uint256) internal _redeemablesFirst;

    mapping(address => MintBudget[]) internal _mintBudgets;
    mapping(address => uint256) internal _mintBudgetsStartIndex;

    function afterMint(
        address to,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        // FIXME: should we check if the user is a contributor? Worst case we end up having
        // minting entries that will never be used.
        _mintBudgets[to].push(MintBudget(block.timestamp, amount));
    }

    function _addRedeemable(
        address account,
        uint256 amount,
        uint256 mintTimestamp,
        uint256 redemptionStarts
    ) internal {
        Redeemable memory offerRedeemable = Redeemable(
            amount,
            mintTimestamp,
            redemptionStarts,
            redemptionStarts + redemptionWindow
        );
        _redeemables[account].push(offerRedeemable);
    }

    function afterOffer(
        address account,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        // Find tokens minted ofer the last 3 months of activity, no earlier than 15 months
        if (_mintBudgets[account].length == 0) {
            return;
        }

        uint256 lastActivity = _mintBudgets[account][
            _mintBudgets[account].length - 1
        ].timestamp;

        // User can redeem tokens minted within 3 months since last activity
        uint256 thresholdActivity = lastActivity - activityWindow;
        // User cannot redeem tokens that were minted earlier than 15 months ago
        uint256 earliestTimestamp = block.timestamp - maxDaysInThePast;

        // If thresholdActivity falls behind the 15 months threshold, we apply a
        // cutoff.
        if (thresholdActivity < earliestTimestamp) {
            thresholdActivity = earliestTimestamp;
        }

        // Calculate when the next redemption starts, that is today plus the
        // time a contributor has to wait to redeem the tokens
        uint256 redemptionStarts = block.timestamp + redemptionStart;

        // Load the mint budgets for that account
        MintBudget[] storage mintBudgets = _mintBudgets[account];
        uint256 i;
        for (
            // Optimization: use the start index to avoid iterating over the
            // whole array
            i = _mintBudgetsStartIndex[account];
            // Iterate until we reach the end of the budgets and we still have
            // an amount to consume
            i < mintBudgets.length && amount > 0;
            i++
        ) {
            MintBudget storage mintBudget = mintBudgets[i];
            // If the mint is within the activity window, consume the mint and
            // create a new Redeemable object
            if (
                mintBudget.timestamp >= thresholdActivity &&
                mintBudget.amount > 0
            ) {
                if (amount >= mintBudget.amount) {
                    amount -= mintBudget.amount;

                    _addRedeemable(
                        account,
                        mintBudget.amount,
                        mintBudget.timestamp,
                        redemptionStarts
                    );
                    mintBudget.amount = 0;
                } else {
                    mintBudget.amount -= amount;

                    _addRedeemable(
                        account,
                        amount,
                        mintBudget.timestamp,
                        redemptionStarts
                    );
                    amount = 0;
                }
            }
        }

        // Optimization: save the start index for later use
        _mintBudgetsStartIndex[account] = i - 1;

        // We may still have some amount to consume, that's why we check if
        // there are some expired redeemables whose original mint is still in
        // the activity threshold.
        Redeemable[] storage accountRedeemables = _redeemables[account];

        for (
            i = _redeemablesFirst[account];
            i < accountRedeemables.length && amount > 0;
            i++
        ) {
            Redeemable storage accountRedeemable = accountRedeemables[i];
            if (
                // If the redeemable expired, and
                block.timestamp >= accountRedeemable.end &&
                // if it wasn't completely redeemed
                accountRedeemable.amount > 0 &&
                // and the original mint is still in the activity threshold
                accountRedeemable.mintTimestamp >= thresholdActivity
            ) {
                // Consume the redeemable
                if (amount >= accountRedeemable.amount) {
                    amount -= accountRedeemable.amount;
                    _addRedeemable(
                        account,
                        accountRedeemable.amount,
                        accountRedeemable.mintTimestamp,
                        redemptionStarts
                    );

                    accountRedeemable.amount = 0;
                } else {
                    accountRedeemable.amount -= amount;
                    _addRedeemable(
                        account,
                        amount,
                        accountRedeemable.mintTimestamp,
                        redemptionStarts
                    );

                    amount = 0;
                }
            }

            if (
                i > 0 &&
                accountRedeemable.mintTimestamp < thresholdActivity &&
                block.timestamp >= accountRedeemable.end
            ) {
                _redeemablesFirst[account] = i - 1;
            }
        }
    }

    function afterRedeem(
        address account,
        uint256 amount
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        Redeemable[] storage redeemables = _redeemables[account];

        for (uint256 i = 0; i < redeemables.length && amount > 0; i++) {
            Redeemable storage redeemable = redeemables[i];
            if (
                block.timestamp >= redeemable.start &&
                block.timestamp < redeemable.end
            ) {
                if (amount < redeemable.amount) {
                    redeemable.amount -= amount;
                    amount = 0;
                } else {
                    amount -= redeemable.amount;
                    redeemable.amount = 0;
                }
            }
        }

        require(
            amount == 0,
            "Redemption controller: amount exceeds redeemable balance"
        );
    }

    function redeemableBalance(
        address account
    ) external view returns (uint256 redeemableAmount) {
        Redeemable[] storage accountRedeemables = _redeemables[account];

        for (uint256 i = 0; i < accountRedeemables.length; i++) {
            Redeemable storage accountRedeemable = accountRedeemables[i];
            if (
                block.timestamp >= accountRedeemable.start &&
                block.timestamp < accountRedeemable.end
            ) {
                redeemableAmount += accountRedeemable.amount;
            }
        }
    }
}
