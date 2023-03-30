// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { Roles } from "../extensions/Roles.sol";
import "./ResolutionManagerBase.sol";
import "../extensions/DAORoles.sol";
import "../extensions/HasRole.sol";

contract ResolutionManager is Initializable, ResolutionManagerBase, HasRole {
    function initialize(
        DAORoles roles,
        IShareholderRegistry shareholderRegistry,
        INeokingdomToken neokingdomToken,
        IVoting voting
    ) public initializer {
        _setRoles(roles);
        _initialize(shareholderRegistry, neokingdomToken, voting);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function addResolutionType(
        string memory name,
        uint256 quorum,
        uint256 noticePeriod,
        uint256 votingPeriod,
        bool canBeNegative
    ) public virtual onlyRole(Roles.RESOLUTION_ROLE) {
        _addResolutionType(
            name,
            quorum,
            noticePeriod,
            votingPeriod,
            canBeNegative
        );
    }

    function setShareholderRegistry(
        IShareholderRegistry shareholderRegistry
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setShareholderRegistry(shareholderRegistry);
    }

    function setNeokingdomToken(
        INeokingdomToken neokingdomToken
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setNeokingdomToken(neokingdomToken);
    }

    function setVoting(
        IVoting voting
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setVoting(voting);
    }

    function createResolution(
        string calldata dataURI,
        uint256 resolutionTypeId,
        bool isNegative,
        address[] memory executionTo,
        bytes[] memory executionData
    ) external virtual returns (uint256) {
        return
            _createResolution(
                dataURI,
                resolutionTypeId,
                isNegative,
                executionTo,
                executionData,
                address(0)
            );
    }

    function createAddressableResolution(
        string calldata dataURI,
        uint256 resolutionTypeId,
        address[] memory executionTo,
        bytes[] memory executionData,
        address addressedContributor
    ) external virtual returns (uint256) {
        return
            _createResolution(
                dataURI,
                resolutionTypeId,
                false,
                executionTo,
                executionData,
                addressedContributor
            );
    }

    function approveResolution(uint256 resolutionId) external virtual {
        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.MANAGING_BOARD_STATUS(),
                _msgSender()
            ),
            "Resolution: only managing board can approve"
        );
        _approveResolution(resolutionId);
    }

    function rejectResolution(uint256 resolutionId) external virtual {
        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.MANAGING_BOARD_STATUS(),
                _msgSender()
            ),
            "Resolution: only managing board can reject"
        );
        _rejectResolution(resolutionId);
    }

    function updateResolution(
        uint256 resolutionId,
        string calldata dataURI,
        uint256 resolutionTypeId,
        bool isNegative,
        address[] memory executionTo,
        bytes[] memory executionData
    ) external virtual {
        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.MANAGING_BOARD_STATUS(),
                _msgSender()
            ),
            "Resolution: only managing board can update"
        );
        _updateResolution(
            resolutionId,
            dataURI,
            resolutionTypeId,
            isNegative,
            executionTo,
            executionData
        );
    }

    function executeResolution(uint256 resolutionId) external virtual {
        _executeResolution(resolutionId);
    }

    function vote(uint256 resolutionId, bool isYes) external virtual {
        _vote(resolutionId, isYes);
    }
}
