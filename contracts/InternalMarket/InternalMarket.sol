// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./InternalMarketBase.sol";
import { Roles } from "../extensions/Roles.sol";
import "../extensions/DAORoles.sol";
import "../extensions/HasRole.sol";

contract InternalMarket is Initializable, HasRole, InternalMarketBase {
    function initialize(DAORoles roles, IERC20 daoToken) public initializer {
        _initialize(daoToken, 7 days);
        _setRoles(roles);
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
        IERC20 token,
        IStdReference oracle
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setExchangePair(token, oracle);
    }

    function setReserve(
        address reserve
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setReserve(reserve);
    }

    function setRedemptionController(
        IRedemptionController redemptionController
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setRedemptionController(redemptionController);
    }

    function setOfferDuration(
        uint duration
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setOfferDuration(duration);
    }
}
