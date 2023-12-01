// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import "../GovernanceToken/GovernanceToken.sol";

contract GovernanceTokenV2Mock is GovernanceToken {
    function transfer(address, uint256) public virtual override returns (bool) {
        require(false, "GovernanceTokenV2: nopety nope");
        return true;
    }
}
