// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./TokenGatewayBase.sol";
import "../extensions/DAORoles.sol";
import "../extensions/HasRole.sol";
import { Roles } from "../extensions/Roles.sol";

contract TokenGateway is Initializable, HasRole, TokenGatewayBase {
    function initialize(
        DAORoles roles,
        INeokingdomTokenExternal tokenExternal,
        INeokingdomToken tokenInternal,
        InternalMarket internalMarket
    ) public initializer {
        _initialize(tokenExternal, tokenInternal, internalMarket);
        _setRoles(roles);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function mint(
        address to,
        uint256 amount
    ) public onlyRole(Roles.RESOLUTION_ROLE) {
        // FIXME: ask marko if we can mint unwrapped tokens to investors.
        _tokenExternal.mint(address(this), amount);
        _tokenInternal.mint(to, amount);
    }

    function deposit(uint amount) public {
        // FIXME: should we check if the address is in the shareholders' registry?
        _deposit(msg.sender, amount);
    }

    function withdraw(address to, uint amount) public {
        _withdraw(msg.sender, to, amount);
    }
}
