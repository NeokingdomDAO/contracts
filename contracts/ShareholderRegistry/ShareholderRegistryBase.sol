// SPDX-License-Identifier: MIT

// TODO: update _statuses when account has no shares
// TODO: check who can move shares

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ShareholderRegistryBase is ERC20 {
    bytes32 public SHAREHOLDER_STATUS = keccak256("SHAREHOLDER_STATUS");
    bytes32 public INVESTOR_STATUS = keccak256("INVESTOR_STATUS");
    bytes32 public CONTRIBUTOR_STATUS = keccak256("CONTRIBUTOR_STATUS");
    bytes32 public FOUNDER_STATUS = keccak256("FOUNDER_STATUS");

    event StatusChanged(
        address indexed account,
        bytes32 previous,
        bytes32 current
    );

    mapping(address => bytes32) private _statuses;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function _setStatus(bytes32 status, address account) internal virtual {
        require(
            isAtLeast(SHAREHOLDER_STATUS, account),
            "Shareholder: address has no tokens"
        );
        bytes32 previous = _statuses[account];
        _beforeSetStatus(account, status);
        _statuses[account] = status;
        _afterSetStatus(account, status);
        emit StatusChanged(account, previous, status);
    }

    function getStatus(address account) public view returns (bytes32) {
        return _statuses[account];
    }

    function isAtLeast(bytes32 status, address account)
        public
        view
        returns (bool)
    {
        return _isAtLeast(balanceOf(account), _statuses[account], status);
    }

    function _isAtLeast(
        uint256 balance,
        bytes32 accountStatus,
        bytes32 status
    ) internal view returns (bool) {
        return
            balance > 0 &&
            // shareholder < investor < contributor < founder
            (status == INVESTOR_STATUS ||
                status == SHAREHOLDER_STATUS ||
                status == accountStatus ||
                (status == CONTRIBUTOR_STATUS &&
                    accountStatus == FOUNDER_STATUS));
    }

    function _beforeSetStatus(address account, bytes32 status)
        internal
        virtual
    {}

    function _afterSetStatus(address account, bytes32 status)
        internal
        virtual
    {}
}
