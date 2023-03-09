// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../NeokingdomToken/NeokingdomToken.sol";
import "../extensions/Roles.sol";

contract NeokingdomTokenV2Mock is NeokingdomToken {
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        if (
            _shareholderRegistry.getStatus(from) ==
            _shareholderRegistry.SHAREHOLDER_STATUS()
        ) {
            // Amount set to zero so it just consumes what's expired
            _drainOffers(from, address(0), 0);
            require(
                amount <= _unlockedBalance[from],
                "NeokingdomToken: transfer amount exceeds unlocked tokens"
            );
        }
    }
}
