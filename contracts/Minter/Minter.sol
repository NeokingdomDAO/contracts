// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "../extensions/DAORoles.sol";
import "../extensions/HasRole.sol";
import { Roles } from "../extensions/Roles.sol";
import "../InternalMarket/InternalMarket.sol";

contract FederalReserve is HasRole {
    ERC20Burnable neokingdomTokenExternal;
    ERC20Burnable neokingdomTokenInternal;
    InternalMarket market;

    constructor(
        ERC20Burnable tokenExternal,
        ERC20Burnable tokenInternal,
        InternalMarket internalMarket
    ) {
        neokingdomTokenExternal = tokenExternal;
        neokingdomTokenInternal = tokenInternal;
    }

    function mint(
        address to,
        uint256 amount
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        // FIXME: ask marko if we can mint unwrapped tokens to investors.

        neokingdomTokenExternal.mint(address(market), amount);
        neokingdomTokenInternal.mint(to, amount);
    }

    function deposit(uint amount) public {
        _deposit(_msgSender(), amount);
    }

    function withdraw(address to, uint amount) public {
        _withdraw(_msgSender(), to, amount);
    }
}
