// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./InternalMarketBase.sol";
import { Roles } from "../extensions/Roles.sol";

contract InternalMarket is Initializable, InternalMarketBase, AccessControl {
    constructor(IERC20 daoToken_) {
        _initialize(daoToken_, 7 days);
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(
            Roles.RESOLUTION_ROLE,
            0x00a329c0648769A73afAc7F9381E08FB43dBEA72
        );
    }

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
