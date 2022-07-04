// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library Roles {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant RESOLUTION_ROLE = keccak256("RESOLUTION_ROLE");
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");
    bytes32 public constant SHAREHOLDER_REGISTRY_ROLE =
        keccak256("SHAREHOLDER_REGISTRY_ROLE");
}
