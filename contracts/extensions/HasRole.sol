// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./DAORoles.sol";

abstract contract HasRole is ContextUpgradeable {
    DAORoles internal _roles;

    function _setRoles(DAORoles roles) internal {
        _roles = roles;
    }

    modifier onlyRole(bytes32 role) {
        address account = _msgSender();
        if (!_roles.hasRole(role, account)) {
            revert(
                string(
                    abi.encodePacked(
                        "AccessControl: account ",
                        Strings.toHexString(account),
                        " is missing role ",
                        Strings.toHexString(uint256(role), 32)
                    )
                )
            );
        }
        _;
    }
}
