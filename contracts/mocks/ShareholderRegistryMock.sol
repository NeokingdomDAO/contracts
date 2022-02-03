// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ShareholderRegistry/IShareholderRegistry.sol";

// This mock is currently used to test some cases in Voting when non contribuors
// access some functionalities. Its logic has therefore be kept at the bare
// minimum to allow the testing script to provide this behaviour.
contract ShareholderRegistryMock is IShareholderRegistry {
    bytes32 public override CONTRIBUTOR_STATUS = "test";
    bytes32 public override SHAREHOLDER_STATUS;
    bytes32 public override INVESTOR_STATUS;
    bytes32 public override FOUNDER_STATUS;

    address _nonContributor;

    function snapshot() public override returns (uint256) {
        
    }

    function setNonContributor(address account) public {
        _nonContributor = account;
    }

    function isAtLeast(bytes32 status, address account)
        public
        view
        override
        returns (bool)
    {
        return status == CONTRIBUTOR_STATUS && _nonContributor != account;
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
        override
        returns (bytes32)
    {}

    function isAtLeastAt(
        bytes32 status,
        address account,
        uint256 snapshotId
    ) public override returns (bool) {}

    function balanceOfAt(address account, uint256 snapshotId)
        public
        override
        returns (uint256)
    {}

    function balanceOf(address account) public override returns (uint256) {}

    function totalSupplyAt(uint256 snapshotId)
        public
        override
        returns (uint256)
    {}

    function totalSupply() public override returns (uint256) {}
}
