// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract ShareholderStatus is ERC20 {
    enum Status {
        SHAREHOLDER,
        INVESTOR,
        CONTRIBUTOR,
        FOUNDER
    }

    event StatusChanged(
        address indexed account,
        Status previous,
        Status current
    );

    mapping(address => Status) private _statuses;

    function _setStatus(address account, Status status) internal virtual {
        Status previous = _statuses[account];
        _beforeSetStatus(account, status);
        _statuses[account] = status;
        _afterSetStatus(account, status);
        emit StatusChanged(account, previous, status);
    }

    function hasStatus(address account, Status status)
        public
        view
        returns (bool)
    {
        return balanceOf(account) > 0 && _statuses[account] == status;
    }

    function _beforeSetStatus(address account, Status status)
        internal
        virtual
    {}

    function _afterSetStatus(address account, Status status) internal virtual {}
}
