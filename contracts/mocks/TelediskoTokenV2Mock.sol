// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../TelediskoToken/TelediskoToken.sol";
import "../extensions/Roles.sol";

contract TelediskoTokenV2Mock is TelediskoToken {
    function _beforeTokenTransfer(
        address,
        address,
        uint256
    ) internal virtual override {
        require(false, "TelediskoTokenV2: nopety nope");
    }
}
