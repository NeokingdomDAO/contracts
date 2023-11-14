// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../extensions/DAORegistryProxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./ResolutionManagerBase.sol";

/**
 * @title ResolutionManager
 * @dev This contract manages the creation, approval, rejection, updating and
 * execution of resolutions. It also allows shareholders to vote on resolutions.
 */
contract ResolutionManager is Initializable, ResolutionManagerBase {
    /**
     * @dev Initializes the contract with the required dependencies.
     * @param daoRegistry The roles extension of the DAO.
     */
    function initialize(DAORegistry daoRegistry) public initializer {
        _setDAORegistry(daoRegistry);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    /**
     * @dev Adds a new resolution type.
     * @param name The name of the new resolution type.
     * @param quorum The quorum required for the new resolution type.
     * @param noticePeriod The notice period required for the new resolution type.
     * @param votingPeriod The voting period required for the new resolution type.
     * @param canBeNegative The flag to indicate if the new resolution type can be negative.
     */
    function addResolutionType(
        string memory name,
        uint256 quorum,
        uint256 noticePeriod,
        uint256 votingPeriod,
        bool canBeNegative
    ) public virtual onlyResolutionManager {
        _addResolutionType(
            name,
            quorum,
            noticePeriod,
            votingPeriod,
            canBeNegative
        );
    }

    /**
     * @dev Creates a new resolution.
     * @param dataURI The data URI of the resolution.
     * @param resolutionTypeId The type of resolution.
     * @param isNegative Whether the resolution is negative.
     * @param executionTo The list of addresses to be called if the resolution is successful.
     * @param executionData The list of actual calldata to be used as payloads if the resolution is successful.
     * @return The id of the newly created resolution.
     */
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

    /**
     * @dev Creates a new resolution with exclusion. Such resolution is votable
     * by all contributors of the DAO but one.
     * @param dataURI The data URI of the resolution.
     * @param resolutionTypeId The type of resolution.
     * @param executionTo The list of addresses to be called if the resolution is successful.
     * @param executionData The list of actual calldata to be used as payloads if the resolution is successful.
     * @param excludedContributor The address of the contributor to be excluded.
     * @return The id of the newly created resolution.
     */
    function createResolutionWithExclusion(
        string calldata dataURI,
        uint256 resolutionTypeId,
        address[] memory executionTo,
        bytes[] memory executionData,
        address excludedContributor
    ) external virtual returns (uint256) {
        return
            _createResolution(
                dataURI,
                resolutionTypeId,
                false,
                executionTo,
                executionData,
                excludedContributor
            );
    }

    /**
     * @dev Approves a resolution.
     * @param resolutionId The id of the resolution to approve.
     */
    function approveResolution(uint256 resolutionId) external virtual {
        _approveResolution(resolutionId);
    }

    /**
     * @dev Rejects a resolution.
     * @param resolutionId The id of the resolution to reject.
     */
    function rejectResolution(uint256 resolutionId) external virtual {
        _rejectResolution(resolutionId);
    }

    /**
     * @dev Updates a resolution.
     * @param resolutionId The id of the resolution to update.
     * @param dataURI The new data URI of the resolution.
     * @param resolutionTypeId The new type of resolution.
     * @param isNegative Whether the resolution is negative.
     * @param executionTo The list of addresses to be called if the resolution is successful.
     * @param executionData The list of actual calldata to be used as payloads if the resolution is successful.
     */
    function updateResolution(
        uint256 resolutionId,
        string calldata dataURI,
        uint256 resolutionTypeId,
        bool isNegative,
        address[] memory executionTo,
        bytes[] memory executionData
    ) external virtual {
        _updateResolution(
            resolutionId,
            dataURI,
            resolutionTypeId,
            isNegative,
            executionTo,
            executionData
        );
    }

    /**
     * @dev Executes a resolution. A resolution can be executed if the voting
     * phase finished and reached the quorum.
     * @param resolutionId The id of the resolution to execute.
     */
    function executeResolution(uint256 resolutionId) external virtual {
        _executeResolution(resolutionId);
    }

    /**
     * @dev Votes on a resolution.
     * @param resolutionId The id of the resolution to vote on.
     * @param isYes Whether the vote is in favor of the resolution.
     */
    function vote(uint256 resolutionId, bool isYes) external virtual {
        _vote(resolutionId, isYes);
    }
}
