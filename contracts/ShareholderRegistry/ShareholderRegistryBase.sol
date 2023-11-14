// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../extensions/DAORegistryProxy.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../Voting/IVoting.sol";

contract ShareholderRegistryBase is ERC20Upgradeable, DAORegistryProxy {
    bytes32 public SHAREHOLDER_STATUS;
    bytes32 public INVESTOR_STATUS;
    bytes32 public CONTRIBUTOR_STATUS;
    bytes32 public MANAGING_BOARD_STATUS;

    event StatusChanged(
        address indexed account,
        bytes32 previous,
        bytes32 current
    );

    mapping(address => bytes32) internal _statuses;

    function _initialize(
        DAORegistry daoRegistry,
        string memory name,
        string memory symbol
    ) internal virtual {
        __DAORegistryProxy_init(daoRegistry);
        __ERC20_init(name, symbol);
        SHAREHOLDER_STATUS = keccak256("SHAREHOLDER_STATUS");
        INVESTOR_STATUS = keccak256("INVESTOR_STATUS");
        CONTRIBUTOR_STATUS = keccak256("CONTRIBUTOR_STATUS");
        MANAGING_BOARD_STATUS = keccak256("MANAGING_BOARD_STATUS");
    }

    function _setStatus(bytes32 status, address account) internal virtual {
        require(
            !Address.isContract(account),
            "ShareholderRegistry: cannot set status for smart contract"
        );
        require(
            status == 0 || isAtLeast(SHAREHOLDER_STATUS, account),
            "ShareholderRegistry: address has no tokens"
        );
        bytes32 previous = _statuses[account];
        emit StatusChanged(account, previous, status);
        _beforeSetStatus(account, previous, status);
        _statuses[account] = status;
        _afterSetStatus(account, previous, status);
    }

    function getStatus(address account) public view virtual returns (bytes32) {
        return _statuses[account];
    }

    function isAtLeast(
        bytes32 status,
        address account
    ) public view virtual returns (bool) {
        return _isAtLeast(balanceOf(account), _statuses[account], status);
    }

    function _batchTransferFromDAO(
        address[] memory recipients
    ) internal virtual {
        uint256 recipientLength = recipients.length;

        for (uint256 i = 0; i < recipientLength; ) {
            _transfer(address(this), recipients[i], 1 ether);

            unchecked {
                i++;
            }
        }
    }

    function _isAtLeast(
        uint256 balance,
        bytes32 accountStatus,
        bytes32 status
    ) internal view virtual returns (bool) {
        return
            balance > 0 &&
            // investor < contributor < managing board
            // TODO: shareholder is currently equivalent to investor.
            // We need to verify with the lawyer whether we can remove it
            // completely from the smart contracts.
            (status == INVESTOR_STATUS ||
                status == SHAREHOLDER_STATUS ||
                status == accountStatus ||
                (status == CONTRIBUTOR_STATUS &&
                    accountStatus == MANAGING_BOARD_STATUS));
    }

    function _beforeSetStatus(
        address account,
        bytes32 statusBefore,
        bytes32 statusAfter
    ) internal virtual {
        if (
            _isAtLeast(1, statusBefore, CONTRIBUTOR_STATUS) &&
            !_isAtLeast(1, statusAfter, CONTRIBUTOR_STATUS)
        ) {
            getVoting().beforeRemoveContributor(account);
        }
    }

    function _afterSetStatus(
        address account,
        bytes32 statusBefore,
        bytes32 statusAfter
    ) internal virtual {
        if (
            !_isAtLeast(1, statusBefore, CONTRIBUTOR_STATUS) &&
            _isAtLeast(1, statusAfter, CONTRIBUTOR_STATUS)
        ) {
            getVoting().afterAddContributor(account);
        }
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        require(
            amount == 1 ether * (amount / 1 ether),
            "ShareholderRegistry: No fractional tokens"
        );
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (balanceOf(from) == 0) {
            _setStatus(0, from);
        }
        getVoting().afterTokenTransfer(from, to, amount);
    }
}
