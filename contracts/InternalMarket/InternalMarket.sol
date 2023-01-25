// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./InternalMarketBase.sol";
import { Roles } from "../extensions/Roles.sol";

contract InternalMarket is InternalMarketBase, AccessControl {
    constructor(IERC20 erc20_) {
        erc20 = erc20_;
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function makeOffer(uint256 amount) public virtual {
        _makeOffer(_msgSender(), amount);
    }

    function matchOffer(
        address from,
        address to,
        uint amount
    ) public onlyRole(Roles.ESCROW_ROLE) {
        _matchOffer(from, to, amount);
    }

    function withdraw(address to, uint amount) public {
        _withdraw(_msgSender(), to, amount);
    }

    function setERC20(IERC20 erc20) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setERC20(erc20);
    }

    function setOfferDuration(
        uint duration
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        _setOfferDuration(duration);
    }
}
