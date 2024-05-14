// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./InternalMarketBase.sol";
import "./IDIAOracleV2.sol";

/**
 * @title InternalMarket
 * @dev A smart contract that handles trading of governance tokens between users,
 * allowing them to make an offer, match existing offers, deposit, withdraw, and redeem locked tokens.
 */
contract InternalMarket is Initializable, InternalMarketBase {
    IDIAOracleV2 internal _diaPriceOracle;

    /**
     * @dev Initializes the contract with the given roles and internal token.
     * @param daoRegistry DAORegistry instance containing custom access control roles.
     */
    function initialize(DAORegistry daoRegistry) public initializer {
        __DAORegistryProxy_init(daoRegistry);
        _initialize(7 days);
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
        require(
            getShareholderRegistry().isAtLeast(
                getShareholderRegistry().CONTRIBUTOR_STATUS(),
                msg.sender
            ),
            "InternalMarket: only contributors can make offers"
        );
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
     * @param to The address of the receiver.
     * @param amount The amount of tokens to redeem.
     */
    function redeem(address to, uint amount) public {
        _redeem(to, amount);
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
        onlyResolutionManager
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
    ) public onlyResolutionManager zeroCheck(address(reserve_)) {
        _setReserve(reserve_);
    }

    /**
     * @dev Set offer duration.
     * @param duration The duration of the offer in seconds.
     */
    function setOfferDuration(uint duration) public onlyResolutionManager {
        _setOfferDuration(duration);
    }
}
