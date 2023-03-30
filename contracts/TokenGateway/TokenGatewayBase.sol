// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../NeokingdomTokenExternal/INeokingdomTokenExternal.sol";
import "../NeokingdomToken/INeokingdomToken.sol";
import "../InternalMarket/InternalMarket.sol";

contract TokenGatewayBase {
    INeokingdomTokenExternal internal _tokenExternal;
    INeokingdomToken internal _tokenInternal;
    InternalMarket internal _internalMarket;

    function _initialize(
        INeokingdomTokenExternal tokenExternal,
        INeokingdomToken tokenInternal,
        InternalMarket internalMarket
    ) internal {
        _tokenExternal = tokenExternal;
        _tokenInternal = tokenInternal;
        _internalMarket = internalMarket;
    }

    function _mint(address to, uint256 amount) internal virtual {
        // FIXME: ask marko if we can mint unwrapped tokens to investors.
        _tokenExternal.mint(address(this), amount);
        _tokenInternal.mint(to, amount);
    }

    function _deposit(address from, uint amount) internal virtual {
        _tokenExternal.transferFrom(from, address(this), amount);
        _tokenInternal.mint(from, amount);
    }

    function _withdraw(address from, address to, uint amount) internal virtual {
        _tokenInternal.burn(from, amount);
        _tokenExternal.transfer(to, amount);
    }
}
