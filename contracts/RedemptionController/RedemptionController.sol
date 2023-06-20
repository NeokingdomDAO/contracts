// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./RedemptionControllerBase.sol";
import { Roles } from "../extensions/Roles.sol";
import "../extensions/DAORoles.sol";
import "../extensions/HasRole.sol";

/**
 * @title RedemptionController
 * @notice Redeemable tokens are decided on Offer. This contract keeps track of
 * how many tokens are redeemable by Contributors.
 * The rules for redeemable tokens are as follow:
 * - When user offers, we check how many tokens are eligible for redemption (3
 *   months, 15 months rule) and mark it as redeemable in 60 days.
 * - When user offers, we check how many tokens are in the vault and how many
 *   are currently redeemable. We take the redeemable amount straight into the
 *   vault, the rest remains locked for 7 days.
 * - When 60 days pass, the token are redeemable for 10 days.
 *    - If the user redeems, tokens are subtracted.
 *    - If the user moves the tokens to the outside or to the contributor
 *      wallet, tokens are subtracted.
 *    - If the user forgets, the tokens are not
 *      redeemable. They can only be moved outside the vault (contributor or
 *      secondary).
 */
contract RedemptionController is
    Initializable,
    HasRole,
    RedemptionControllerBase
{
    /**
     * @dev Initializes the smart contract.
     * @param roles The addresses of DAORoles for this contract.
     */
    function initialize(DAORoles roles) public initializer {
        _setRoles(roles);
        _initialize();
    }

    /**
     * @dev Empty initializer function needed for OpenZeppelin.
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    /**
     * @dev Called after mint operation, updates redemption information based on minted amount.
     * @notice Must be called by an address with TOKEN_MANAGER_ROLE.
     * @param to The address receiving the minted tokens.
     * @param amount The amount of minted tokens.
     */
    function afterMint(
        address to,
        uint256 amount
    ) external override onlyRole(Roles.TOKEN_MANAGER_ROLE) {
        _afterMint(to, amount);
    }

    /**
     * @dev Called after offer operation, updates redemption information based on offered amount.
     * @notice Must be called by an address with TOKEN_MANAGER_ROLE.
     * @param account The address offering the tokens.
     * @param amount The amount of offered tokens.
     */
    function afterOffer(
        address account,
        uint256 amount
    ) external override onlyRole(Roles.TOKEN_MANAGER_ROLE) {
        _afterOffer(account, amount);
    }

    /**
     * @dev Called after redeem operation, updates redemption information based on redeemed amount.
     * @notice Must be called by an address with TOKEN_MANAGER_ROLE.
     * @param account The address redeeming the tokens.
     * @param amount The amount of redeemed tokens.
     */
    function afterRedeem(
        address account,
        uint256 amount
    ) external override onlyRole(Roles.TOKEN_MANAGER_ROLE) {
        _afterRedeem(account, amount);
    }
}
