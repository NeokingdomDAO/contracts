// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "../NeokingdomToken/NeokingdomToken.sol";
import "../extensions/Roles.sol";

contract NeokingdomTokenV2Mock is NeokingdomToken {
    function transfer(address, uint256) public virtual override returns (bool) {
        require(false, "NeokingdomTokenV2: nopety nope");
        return true;
    }
}
