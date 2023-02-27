// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "../NeokingdomToken/INeokingdomToken.sol";
import "../Voting/IVoting.sol";
import "../extensions/Roles.sol";
import "hardhat/console.sol";

contract ResolutionManager is Initializable, Context, AccessControl {
    uint256 internal _currentResolutionId;

    IShareholderRegistry internal _shareholderRegistry;
    INeokingdomToken internal _neokingdomToken;
    IVoting internal _voting;

    event ResolutionCreated(address indexed from, uint256 indexed resolutionId);
    event ResolutionUpdated(address indexed from, uint256 indexed resolutionId);
    event ResolutionApproved(
        address indexed from,
        uint256 indexed resolutionId
    );
    event ResolutionRejected(
        address indexed from,
        uint256 indexed resolutionId
    );
    event ResolutionVoted(
        address indexed from,
        uint256 indexed resolutionId,
        uint256 votingPower,
        bool isYes
    );
    event ResolutionExecuted(
        address indexed from,
        uint256 indexed resolutionId
    );
    event ResolutionTypeCreated(
        address indexed from,
        uint256 indexed typeIndex
    );
    event DelegateLostVotingPower(
        address indexed from,
        uint256 indexed resolutionId,
        uint256 amount
    );

    // TODO: make resolution type indices more explicit
    struct ResolutionType {
        string name;
        uint256 quorum;
        uint256 noticePeriod;
        uint256 votingPeriod;
        bool canBeNegative;
    }

    ResolutionType[] public resolutionTypes;

    struct Resolution {
        string dataURI;
        uint256 resolutionTypeId;
        uint256 approveTimestamp;
        uint256 snapshotId;
        uint256 yesVotesTotal;
        bool isNegative;
        uint256 rejectionTimestamp;
        // Transaction fields
        address[] executionTo;
        bytes[] executionData;
        uint256 executionTimestamp;
        mapping(address => bool) hasVoted;
        mapping(address => bool) hasVotedYes;
        mapping(address => uint256) lostVotingPower;
    }

    mapping(uint256 => Resolution) public resolutions;

    function initialize(
        IShareholderRegistry shareholderRegistry,
        INeokingdomToken neokingdomToken,
        IVoting voting
    ) public initializer {
        _shareholderRegistry = shareholderRegistry;
        _neokingdomToken = neokingdomToken;
        _voting = voting;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // TODO: check if there are any rounding errors
        _addResolutionType("amendment", 66, 14 days, 6 days, false);
        _addResolutionType("capitalChange", 66, 14 days, 6 days, false);
        _addResolutionType("preclusion", 75, 14 days, 6 days, false);
        _addResolutionType("fundamentalOther", 51, 14 days, 6 days, false);
        _addResolutionType("significant", 51, 6 days, 4 days, false);
        _addResolutionType("dissolution", 66, 14 days, 6 days, false);
        _addResolutionType("routine", 51, 3 days, 2 days, true);
        _addResolutionType("genesis", 100, 0 days, 4 days, false);

        _currentResolutionId = 1;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    modifier onlyPending(uint256 resolutionId) {
        Resolution storage resolution = resolutions[resolutionId];
        require(
            resolution.approveTimestamp == 0,
            "Resolution: already approved"
        );
        require(
            resolution.rejectionTimestamp == 0,
            "Resolution: already rejected"
        );

        _;
    }

    modifier exists(uint256 resolutionId) {
        require(
            resolutionId < _currentResolutionId,
            "Resolution: does not exist"
        );

        _;
    }

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

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        virtual
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _shareholderRegistry = shareholderRegistry;
    }

    function setNeokingdomToken(INeokingdomToken neokingdomToken)
        external
        virtual
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _neokingdomToken = neokingdomToken;
    }

    function setVoting(IVoting voting)
        external
        virtual
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _voting = voting;
    }

    function _snapshotAll() internal virtual returns (uint256) {
        _shareholderRegistry.snapshot();
        _neokingdomToken.snapshot();
        return _voting.snapshot();
    }

    function createResolution(
        string calldata dataURI,
        uint256 resolutionTypeId,
        bool isNegative,
        address[] memory executionTo,
        bytes[] memory executionData
    ) public virtual returns (uint256) {
        ResolutionType storage resolutionType = resolutionTypes[
            resolutionTypeId
        ];
        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                _msgSender()
            ),
            "Resolution: only contributor can create"
        );
        require(
            !isNegative || resolutionType.canBeNegative,
            "Resolution: cannot be negative"
        );
        require(
            executionTo.length == executionData.length,
            "Resolution: length mismatch"
        );
        uint256 resolutionId = _currentResolutionId++;
        Resolution storage resolution = resolutions[resolutionId];

        resolution.dataURI = dataURI;
        resolution.resolutionTypeId = resolutionTypeId;
        resolution.isNegative = isNegative;
        resolution.executionTo = executionTo;
        resolution.executionData = executionData;

        emit ResolutionCreated(_msgSender(), resolutionId);
        return resolutionId;
    }

    function approveResolution(uint256 resolutionId)
        public
        virtual
        onlyPending(resolutionId)
        exists(resolutionId)
    {
        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.MANAGING_BOARD_STATUS(),
                _msgSender()
            ),
            "Resolution: only managing board can approve"
        );

        Resolution storage resolution = resolutions[resolutionId];
        resolution.approveTimestamp = block.timestamp;
        resolution.snapshotId = _snapshotAll();
        emit ResolutionApproved(_msgSender(), resolutionId);
    }

    function rejectResolution(uint256 resolutionId)
        public
        virtual
        onlyPending(resolutionId)
        exists(resolutionId)
    {
        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.MANAGING_BOARD_STATUS(),
                _msgSender()
            ),
            "Resolution: only managing board can reject"
        );

        Resolution storage resolution = resolutions[resolutionId];

        resolution.rejectionTimestamp = block.timestamp;
        emit ResolutionRejected(_msgSender(), resolutionId);
    }

    function updateResolution(
        uint256 resolutionId,
        string calldata dataURI,
        uint256 resolutionTypeId,
        bool isNegative,
        address[] memory executionTo,
        bytes[] memory executionData
    ) public virtual onlyPending(resolutionId) {
        Resolution storage resolution = resolutions[resolutionId];
        require(
            executionTo.length == executionData.length,
            "Resolution: length mismatch"
        );

        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.MANAGING_BOARD_STATUS(),
                _msgSender()
            ),
            "Resolution: only managing board can update"
        );

        ResolutionType storage resolutionType = resolutionTypes[
            resolutionTypeId
        ];
        require(
            !isNegative || resolutionType.canBeNegative,
            "Resolution: cannot be negative"
        );

        resolution.dataURI = dataURI;
        resolution.resolutionTypeId = resolutionTypeId;
        resolution.isNegative = isNegative;
        resolution.executionTo = executionTo;
        resolution.executionData = executionData;

        emit ResolutionUpdated(_msgSender(), resolutionId);
    }

    function executeResolution(uint256 resolutionId) public virtual {
        Resolution storage resolution = resolutions[resolutionId];
        require(
            resolution.executionTo.length > 0,
            "Resolution: nothing to execute"
        );
        require(resolution.approveTimestamp > 0, "Resolution: not approved");
        require(
            resolution.executionTimestamp == 0,
            "Resolution: already executed"
        );

        (, uint256 votingEnd) = _votingWindow(resolution);

        require(block.timestamp >= votingEnd, "Resolution: not ended");

        require(getResolutionResult(resolutionId), "Resolution: not passed");

        address[] memory to = resolution.executionTo;
        bytes[] memory data = resolution.executionData;

        // Set timestamp before execution as a re-entrancy guard.
        resolution.executionTimestamp = block.timestamp;

        for (uint256 i; i < to.length; i++) {
            (bool success, ) = to[i].call(data[i]);
            require(success, "Resolution: execution failed");
        }
        emit ResolutionExecuted(_msgSender(), resolutionId);
    }

    function getExecutionDetails(uint256 resolutionId)
        public
        view
        returns (address[] memory, bytes[] memory)
    {
        Resolution storage resolution = resolutions[resolutionId];

        return (resolution.executionTo, resolution.executionData);
    }

    function getVoterVote(uint256 resolutionId, address voter)
        public
        view
        virtual
        returns (
            bool isYes,
            bool hasVoted,
            uint256 votingPower
        )
    {
        Resolution storage resolution = resolutions[resolutionId];
        require(
            _voting.canVoteAt(voter, resolution.snapshotId),
            "Resolution: account could not vote resolution"
        );

        isYes = resolution.hasVotedYes[voter];
        hasVoted = resolution.hasVoted[voter];

        if (
            _voting.getDelegateAt(voter, resolution.snapshotId) != voter &&
            hasVoted
        ) {
            votingPower = _neokingdomToken.balanceOfAt(
                voter,
                resolution.snapshotId
            );
        } else {
            votingPower =
                _voting.getVotingPowerAt(voter, resolution.snapshotId) -
                resolution.lostVotingPower[voter];
        }
    }

    function getResolutionResult(uint256 resolutionId)
        public
        view
        virtual
        returns (bool)
    {
        Resolution storage resolution = resolutions[resolutionId];
        ResolutionType storage resolutionType = resolutionTypes[
            resolution.resolutionTypeId
        ];
        uint256 totalVotingPower = _voting.getTotalVotingPowerAt(
            resolution.snapshotId
        );

        bool hasQuorum = resolution.yesVotesTotal * 100 >=
            resolutionType.quorum * totalVotingPower;

        return resolution.isNegative ? !hasQuorum : hasQuorum;
    }

    function vote(uint256 resolutionId, bool isYes) public virtual {
        Resolution storage resolution = resolutions[resolutionId];
        require(
            _voting.canVoteAt(_msgSender(), resolution.snapshotId),
            "Resolution: account cannot vote"
        );

        require(
            isYes != resolution.hasVotedYes[_msgSender()] ||
                !resolution.hasVoted[_msgSender()],
            "Resolution: can't repeat same vote"
        );
        require(resolution.approveTimestamp > 0, "Resolution: not approved");

        (uint256 votingStart, uint256 votingEnd) = _votingWindow(resolution);

        require(
            block.timestamp >= votingStart && block.timestamp < votingEnd,
            "Resolution: not votable"
        );

        uint256 votingPower = _voting.getVotingPowerAt(
            _msgSender(),
            resolution.snapshotId
        );
        address delegate = _voting.getDelegateAt(
            _msgSender(),
            resolution.snapshotId
        );

        // If sender has a delegate load voting power from NeokingdomToken
        if (delegate != _msgSender()) {
            votingPower = _neokingdomToken.balanceOfAt(
                _msgSender(),
                resolution.snapshotId
            );
            // If sender didn't vote before and has a delegate
            //if (!resolution.hasVoted[_msgSender()]) {
            // Did sender's delegate vote?
            if (
                resolution.hasVoted[delegate] &&
                resolution.hasVotedYes[delegate]
            ) {
                resolution.yesVotesTotal -= votingPower;
            }
            resolution.lostVotingPower[delegate] += votingPower;
            emit DelegateLostVotingPower(delegate, resolutionId, votingPower);
            //}
        }

        // votingPower is set
        // delegate vote has been cleared
        votingPower -= resolution.lostVotingPower[_msgSender()];

        if (isYes && !resolution.hasVotedYes[_msgSender()]) {
            // If sender votes yes and hasn't voted yes before
            resolution.yesVotesTotal += votingPower;
        } else if (resolution.hasVotedYes[_msgSender()]) {
            // If sender votes no and voted yes before
            resolution.yesVotesTotal -= votingPower;
        }

        emit ResolutionVoted(_msgSender(), resolutionId, votingPower, isYes);

        resolution.hasVoted[_msgSender()] = true;
        resolution.hasVotedYes[_msgSender()] = isYes;
    }

    function _votingWindow(Resolution storage resolution)
        internal
        view
        virtual
        returns (uint256 _votingStart, uint256 _votingEnd)
    {
        ResolutionType storage resolutionType = resolutionTypes[
            resolution.resolutionTypeId
        ];

        _votingStart =
            resolution.approveTimestamp +
            resolutionType.noticePeriod;
        _votingEnd = _votingStart + resolutionType.votingPeriod;
    }

    function _addResolutionType(
        string memory name,
        uint256 quorum,
        uint256 noticePeriod,
        uint256 votingPeriod,
        bool canBeNegative
    ) internal virtual {
        resolutionTypes.push(
            ResolutionType(
                name,
                quorum,
                noticePeriod,
                votingPeriod,
                canBeNegative
            )
        );

        emit ResolutionTypeCreated(_msgSender(), resolutionTypes.length - 1);
    }
}
