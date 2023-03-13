// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "../NeokingdomToken/NeokingdomToken.sol";
import "../extensions/Roles.sol";

contract NeokingdomTokenV2Mock is NeokingdomToken {
    function _beforeTokenTransfer(
        address,
        address,
        uint256
    ) internal virtual override {
        require(false, "NeokingdomTokenV2: nopety nope");
    }
}
