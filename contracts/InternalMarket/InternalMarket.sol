// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./InternalMarketBase.sol";
import { Roles } from "../extensions/Roles.sol";
import "../extensions/DAORoles.sol";
import "../extensions/HasRole.sol";
import "./IDIAOracleV2.sol";

/**
 * @title InternalMarket
 * @dev A smart contract that handles trading of governance tokens between users,
 * allowing them to make an offer, match existing offers, deposit, withdraw, and redeem locked tokens.
 */
contract InternalMarket is Initializable, HasRole, InternalMarketBase {
    IDIAOracleV2 internal _diaPriceOracle;

    /**
     * @dev Initializes the contract with the given roles and internal token.
     * @param roles DAORoles instance containing custom access control roles.
     * @param tokenInternal_ Reference to governance token.
     */
    function initialize(
        DAORoles roles,
        IGovernanceToken tokenInternal_
    ) public initializer {
        _initialize(tokenInternal_, 7 days);
        _setRoles(roles);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    modifier zeroCheck(address address_) {
        require(address_ != address(0), "InternalMarket: 0x0 not allowed");
        _;
    }

    /**
     * @dev Make an offer to sell the governance tokens.
     * @param amount The amount of tokens to offer for sale.
     */
    function makeOffer(uint256 amount) public virtual {
        _makeOffer(_msgSender(), amount);
    }

    /**
     * @dev Match an existing offer to buy.
     * @param account The address of the user who made the offer.
     * @param amount The amount of tokens to get from the offer.
     */
    function matchOffer(address account, uint amount) public {
        _matchOffer(account, _msgSender(), amount);
    }

    /**
     * @dev Withdraw liquidity from the locked funds.
     * @param to The address that will receive the withdrawn funds.
     * @param amount The amount of tokens to withdraw.
     */
    function withdraw(address to, uint amount) public {
        _withdraw(_msgSender(), to, amount);
    }

    /**
     * @dev Deposit liquidity to the contract.
     * @param amount The amount of tokens to deposit.
     */
    function deposit(uint amount) public {
        _deposit(_msgSender(), amount);
    }

    /**
     * @dev Finalize the deposit.
     */
    function finalizeDeposit() public {
        _finalizeDeposit(_msgSender());
    }

    /**
     * @dev Redeem the locked tokens.
     * @param amount The amount of tokens to redeem.
     */
    function redeem(uint amount) public {
        _redeem(_msgSender(), amount);
    }

    /**
     * @dev Set internal token reference.
     * @param token The address of the internal governance token.
     */
    function setTokenInternal(
        IGovernanceToken token
    ) public onlyRole(Roles.RESOLUTION_ROLE) zeroCheck(address(token)) {
        _setTokenInternal(token);
    }

    /**
     * @dev Set shareholder registry reference.
     * @param shareholderRegistry The address of the shareholder registry contract.
     */
    function setShareholderRegistry(
        IShareholderRegistry shareholderRegistry
    )
        public
        onlyRole(Roles.RESOLUTION_ROLE)
        zeroCheck(address(shareholderRegistry))
    {
        _setShareholderRegistry(shareholderRegistry);
    }

    /**
     * @dev Set the exchange pair and Oracle reference.
     * @param token The address of the ERC20 token to set as the exchange pair.
     * @param oracle The address of the Oracle contract used for price reference.
     */
    function setExchangePair(
        ERC20 token,
        IDIAOracleV2 oracle
    )
        public
        onlyRole(Roles.RESOLUTION_ROLE)
        zeroCheck(address(token))
        zeroCheck(address(oracle))
    {
        _setExchangePair(token, oracle);
    }

    /**
     * @dev Set reserve address.
     * @param reserve_ The address for the reserve.
     */
    function setReserve(
        address reserve_
    ) public onlyRole(Roles.RESOLUTION_ROLE) zeroCheck(address(reserve_)) {
        _setReserve(reserve_);
    }

    /**
     * @dev Set redemption controller address.
     * @param redemptionController_ The address of the redemption controller.
     */
    function setRedemptionController(
        IRedemptionController redemptionController_
    )
        public
        onlyRole(Roles.RESOLUTION_ROLE)
        zeroCheck(address(redemptionController_))
    {
        _setRedemptionController(redemptionController_);
    }

    /**
     * @dev Set offer duration.
     * @param duration The duration of the offer in seconds.
     */
    function setOfferDuration(
        uint duration
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setOfferDuration(duration);
    }
}
