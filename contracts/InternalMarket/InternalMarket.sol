// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./InternalMarketBase.sol";
import { Roles } from "../extensions/Roles.sol";

contract InternalMarket is
    Initializable,
    InternalMarketBase,
    AccessControlUpgradeable
{
    function initialize(IERC20 daoToken_) public initializer {
        _initialize(daoToken_, 7 days);
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function makeOffer(uint256 amount) public virtual {
        _makeOffer(_msgSender(), amount);
    }

    function matchOffer(address account, uint amount) public {
        _matchOffer(account, _msgSender(), amount);
    }

    function withdraw(address to, uint amount) public {
        _withdraw(_msgSender(), to, amount);
    }

    function redeem(uint amount) public {
        _redeem(_msgSender(), amount);
    }

    function setDaoToken(IERC20 token) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setDaoToken(token);
    }

    function setExchangePair(
        ERC20 token,
        IStdReference oracle
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setExchangePair(token, oracle);
    }

    function setReserve(
        address reserve_
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setReserve(reserve_);
    }

    function setRedemptionController(
        IRedemptionController redemptionController_
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setRedemptionController(redemptionController_);
    }

    function setOfferDuration(
        uint duration
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setOfferDuration(duration);
    }
}
