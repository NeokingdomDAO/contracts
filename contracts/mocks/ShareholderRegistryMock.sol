// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ShareholderRegistry/IShareholderRegistry.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// This mock is currently used to test some cases in Voting when non contribuors
// access some functionalities. Its logic has therefore be kept at the bare
// minimum to allow the testing script to provide this behaviour.
contract ShareholderRegistryMock is Initializable, IShareholderRegistry {
    bytes32 public SHAREHOLDER_STATUS;
    bytes32 public INVESTOR_STATUS;
    bytes32 public CONTRIBUTOR_STATUS;
    bytes32 public MANAGING_BOARD_STATUS;

    function initialize() public initializer {
        SHAREHOLDER_STATUS = keccak256("SHAREHOLDER_STATUS");
        INVESTOR_STATUS = keccak256("INVESTOR_STATUS");
        CONTRIBUTOR_STATUS = keccak256("CONTRIBUTOR_STATUS");
        MANAGING_BOARD_STATUS = keccak256("MANAGING_BOARD_STATUS");
    }

    mapping(bytes32 => mapping(address => bool)) mockResult_isAtLeast;

    function snapshot() public override returns (uint256) {}

    function mock_isAtLeast(
        bytes32 status,
        address account,
        bool value
    ) public {
        mockResult_isAtLeast[status][account] = value;
    }

    function isAtLeast(bytes32 status, address account)
        public
        view
        override
        returns (bool)
    {
        return mockResult_isAtLeast[status][account];
    }

    // Unneeded for testing
    function getStatus(address account)
        public
        view
        override
        returns (bytes32)
    {}

    function getStatusAt(address account, uint256 snapshotId)
        public
        view
        override
        returns (bytes32)
    {}

    function isAtLeastAt(
        bytes32 status,
        address account,
        uint256 snapshotId
    ) public view override returns (bool) {}

    function balanceOfAt(address account, uint256 snapshotId)
        public
        view
        override
        returns (uint256)
    {}

    function balanceOf(address account)
        public
        view
        override
        returns (uint256)
    {}

    function totalSupplyAt(uint256 snapshotId)
        public
        view
        override
        returns (uint256)
    {}

    function totalSupply() public view override returns (uint256) {}
}
