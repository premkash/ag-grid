/**
 * @ag-grid-community/core - Advanced Data Grid / Data Table supporting Javascript / React / AngularJS / Web Components
 * @version v23.2.1
 * @link http://www.ag-grid.com/
 * @license MIT
 */
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var columnGroup_1 = require("../entities/columnGroup");
var column_1 = require("../entities/column");
var events_1 = require("../events");
var beanStub_1 = require("../context/beanStub");
var originalColumnGroup_1 = require("../entities/originalColumnGroup");
var groupInstanceIdCreator_1 = require("./groupInstanceIdCreator");
var context_1 = require("../context/context");
var constants_1 = require("../constants");
var array_1 = require("../utils/array");
var utils_1 = require("../utils");
var ColumnController = /** @class */ (function (_super) {
    __extends(ColumnController, _super);
    function ColumnController() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        // header row count, based on user provided columns
        _this.primaryHeaderRowCount = 0;
        _this.secondaryHeaderRowCount = 0;
        _this.secondaryColumnsPresent = false;
        // header row count, either above, or based on pivoting if we are pivoting
        _this.gridHeaderRowCount = 0;
        // these are the lists used by the rowRenderer to render nodes. almost the leaf nodes of the above
        // displayed trees, however it also takes into account if the groups are open or not.
        _this.displayedLeftColumns = [];
        _this.displayedRightColumns = [];
        _this.displayedCenterColumns = [];
        // all three lists above combined
        _this.allDisplayedColumns = [];
        // same as above, except trimmed down to only columns within the viewport
        _this.allDisplayedVirtualColumns = [];
        _this.allDisplayedCenterVirtualColumns = [];
        _this.rowGroupColumns = [];
        _this.valueColumns = [];
        _this.pivotColumns = [];
        _this.ready = false;
        _this.autoGroupsNeedBuilding = false;
        _this.forceRecreateAutoGroups = false;
        _this.pivotMode = false;
        _this.bodyWidth = 0;
        _this.leftWidth = 0;
        _this.rightWidth = 0;
        _this.bodyWidthDirty = true;
        _this.flexActive = false;
        return _this;
    }
    ColumnController.prototype.init = function () {
        this.suppressColumnVirtualisation = this.gridOptionsWrapper.isSuppressColumnVirtualisation();
        var pivotMode = this.gridOptionsWrapper.isPivotMode();
        if (this.isPivotSettingAllowed(pivotMode)) {
            this.pivotMode = pivotMode;
        }
        this.usingTreeData = this.gridOptionsWrapper.isTreeData();
        this.addManagedListener(this.gridOptionsWrapper, 'autoGroupColumnDef', this.onAutoGroupColumnDefChanged.bind(this));
    };
    ColumnController.prototype.onAutoGroupColumnDefChanged = function () {
        this.autoGroupsNeedBuilding = true;
        this.forceRecreateAutoGroups = true;
        this.updateGridColumns();
        this.updateDisplayedColumns('gridOptionsChanged');
    };
    ColumnController.prototype.setColumnDefs = function (columnDefs, source) {
        if (source === void 0) { source = 'api'; }
        var colsPreviouslyExisted = !!this.columnDefs;
        this.columnDefs = columnDefs;
        // always invalidate cache on changing columns, as the column id's for the new columns
        // could overlap with the old id's, so the cache would return old values for new columns.
        this.valueCache.expire();
        // NOTE ==================
        // we should be destroying the existing columns and groups if they exist, for example, the original column
        // group adds a listener to the columns, it should be also removing the listeners
        this.autoGroupsNeedBuilding = true;
        var oldPrimaryColumns = this.primaryColumns;
        var balancedTreeResult = this.columnFactory.createColumnTree(columnDefs, true, oldPrimaryColumns);
        this.primaryColumnTree = balancedTreeResult.columnTree;
        this.primaryHeaderRowCount = balancedTreeResult.treeDept + 1;
        this.primaryColumns = this.getColumnsFromTree(this.primaryColumnTree);
        this.extractRowGroupColumns(source, oldPrimaryColumns);
        this.extractPivotColumns(source, oldPrimaryColumns);
        this.createValueColumns(source, oldPrimaryColumns);
        this.ready = true;
        this.updateGridColumns();
        this.updateDisplayedColumns(source);
        this.checkDisplayedVirtualColumns();
        if (this.gridOptionsWrapper.isImmutableColumns() && colsPreviouslyExisted) {
            this.resetColumnState(true, source);
        }
        var eventEverythingChanged = {
            type: events_1.Events.EVENT_COLUMN_EVERYTHING_CHANGED,
            api: this.gridApi,
            columnApi: this.columnApi,
            source: source
        };
        this.eventService.dispatchEvent(eventEverythingChanged);
        var newColumnsLoadedEvent = {
            type: events_1.Events.EVENT_NEW_COLUMNS_LOADED,
            api: this.gridApi,
            columnApi: this.columnApi
        };
        this.eventService.dispatchEvent(newColumnsLoadedEvent);
        this.flexActive = this.getDisplayedCenterColumns().some(function (col) { return !!col.getFlex(); });
    };
    ColumnController.prototype.isAutoRowHeightActive = function () {
        return this.autoRowHeightColumns && this.autoRowHeightColumns.length > 0;
    };
    ColumnController.prototype.getAllAutoRowHeightCols = function () {
        return this.autoRowHeightColumns;
    };
    ColumnController.prototype.setVirtualViewportLeftAndRight = function () {
        if (this.gridOptionsWrapper.isEnableRtl()) {
            this.viewportLeft = this.bodyWidth - this.scrollPosition - this.scrollWidth;
            this.viewportRight = this.bodyWidth - this.scrollPosition;
        }
        else {
            this.viewportLeft = this.scrollPosition;
            this.viewportRight = this.scrollWidth + this.scrollPosition;
        }
    };
    // used by clipboard service, to know what columns to paste into
    ColumnController.prototype.getDisplayedColumnsStartingAt = function (column) {
        var currentColumn = column;
        var columns = [];
        while (currentColumn != null) {
            columns.push(currentColumn);
            currentColumn = this.getDisplayedColAfter(currentColumn);
        }
        return columns;
    };
    // checks what columns are currently displayed due to column virtualisation. fires an event
    // if the list of columns has changed.
    // + setColumnWidth(), setVirtualViewportPosition(), setColumnDefs(), sizeColumnsToFit()
    ColumnController.prototype.checkDisplayedVirtualColumns = function () {
        // check displayCenterColumnTree exists first, as it won't exist when grid is initialising
        if (this.displayedCenterColumns == null) {
            return;
        }
        var hashBefore = this.allDisplayedVirtualColumns.map(function (column) { return column.getId(); }).join('#');
        this.updateVirtualSets();
        var hashAfter = this.allDisplayedVirtualColumns.map(function (column) { return column.getId(); }).join('#');
        if (hashBefore !== hashAfter) {
            var event_1 = {
                type: events_1.Events.EVENT_VIRTUAL_COLUMNS_CHANGED,
                api: this.gridApi,
                columnApi: this.columnApi
            };
            this.eventService.dispatchEvent(event_1);
        }
    };
    ColumnController.prototype.setVirtualViewportPosition = function (scrollWidth, scrollPosition) {
        if (scrollWidth !== this.scrollWidth || scrollPosition !== this.scrollPosition || this.bodyWidthDirty) {
            this.scrollWidth = scrollWidth;
            this.scrollPosition = scrollPosition;
            // we need to call setVirtualViewportLeftAndRight() at least once after the body width changes,
            // as the viewport can stay the same, but in RTL, if body width changes, we need to work out the
            // virtual columns again
            this.bodyWidthDirty = true;
            this.setVirtualViewportLeftAndRight();
            if (this.ready) {
                this.checkDisplayedVirtualColumns();
            }
        }
    };
    ColumnController.prototype.isPivotMode = function () {
        return this.pivotMode;
    };
    ColumnController.prototype.isPivotSettingAllowed = function (pivot) {
        if (pivot && this.gridOptionsWrapper.isTreeData()) {
            console.warn("ag-Grid: Pivot mode not available in conjunction Tree Data i.e. 'gridOptions.treeData: true'");
            return false;
        }
        return true;
    };
    ColumnController.prototype.setPivotMode = function (pivotMode, source) {
        if (source === void 0) { source = 'api'; }
        if (pivotMode === this.pivotMode || !this.isPivotSettingAllowed(this.pivotMode)) {
            return;
        }
        this.pivotMode = pivotMode;
        // we need to update grid columns to cover the scenario where user has groupSuppressAutoColumn=true, as
        // this means we don't use auto group column UNLESS we are in pivot mode (it's mandatory in pivot mode),
        // so need to updateGridColumn() to check it autoGroupCol needs to be added / removed
        this.autoGroupsNeedBuilding = true;
        this.updateGridColumns();
        this.updateDisplayedColumns(source);
        var event = {
            type: events_1.Events.EVENT_COLUMN_PIVOT_MODE_CHANGED,
            api: this.gridApi,
            columnApi: this.columnApi
        };
        this.eventService.dispatchEvent(event);
    };
    ColumnController.prototype.getSecondaryPivotColumn = function (pivotKeys, valueColKey) {
        if (!this.secondaryColumnsPresent || !this.secondaryColumns) {
            return null;
        }
        var valueColumnToFind = this.getPrimaryColumn(valueColKey);
        var foundColumn = null;
        this.secondaryColumns.forEach(function (column) {
            var thisPivotKeys = column.getColDef().pivotKeys;
            var pivotValueColumn = column.getColDef().pivotValueColumn;
            var pivotKeyMatches = array_1.areEqual(thisPivotKeys, pivotKeys);
            var pivotValueMatches = pivotValueColumn === valueColumnToFind;
            if (pivotKeyMatches && pivotValueMatches) {
                foundColumn = column;
            }
        });
        return foundColumn;
    };
    ColumnController.prototype.setBeans = function (loggerFactory) {
        this.logger = loggerFactory.create('ColumnController');
    };
    ColumnController.prototype.setFirstRightAndLastLeftPinned = function (source) {
        var lastLeft;
        var firstRight;
        if (this.gridOptionsWrapper.isEnableRtl()) {
            lastLeft = this.displayedLeftColumns ? this.displayedLeftColumns[0] : null;
            firstRight = this.displayedRightColumns ? utils_1._.last(this.displayedRightColumns) : null;
        }
        else {
            lastLeft = this.displayedLeftColumns ? utils_1._.last(this.displayedLeftColumns) : null;
            firstRight = this.displayedRightColumns ? this.displayedRightColumns[0] : null;
        }
        this.gridColumns.forEach(function (column) {
            column.setLastLeftPinned(column === lastLeft, source);
            column.setFirstRightPinned(column === firstRight, source);
        });
    };
    ColumnController.prototype.autoSizeColumns = function (keys, skipHeader, source) {
        // because of column virtualisation, we can only do this function on columns that are
        // actually rendered, as non-rendered columns (outside the viewport and not rendered
        // due to column virtualisation) are not present. this can result in all rendered columns
        // getting narrowed, which in turn introduces more rendered columns on the RHS which
        // did not get autosized in the original run, leaving the visible grid with columns on
        // the LHS sized, but RHS no. so we keep looping through the visible columns until
        // no more cols are available (rendered) to be resized
        var _this = this;
        if (source === void 0) { source = "api"; }
        // we autosize after animation frames finish in case any cell renderers need to complete first. this can
        // happen eg if client code is calling api.autoSizeAllColumns() straight after grid is initialised, but grid
        // hasn't fully drawn out all the cells yet (due to cell renderers in animation frames).
        this.animationFrameService.flushAllFrames();
        // keep track of which cols we have resized in here
        var columnsAutosized = [];
        // initialise with anything except 0 so that while loop executes at least once
        var changesThisTimeAround = -1;
        if (skipHeader == null) {
            skipHeader = this.gridOptionsWrapper.isSkipHeaderOnAutoSize();
        }
        while (changesThisTimeAround !== 0) {
            changesThisTimeAround = 0;
            this.actionOnGridColumns(keys, function (column) {
                // if already autosized, skip it
                if (columnsAutosized.indexOf(column) >= 0) {
                    return false;
                }
                // get how wide this col should be
                var preferredWidth = _this.autoWidthCalculator.getPreferredWidthForColumn(column, skipHeader);
                // preferredWidth = -1 if this col is not on the screen
                if (preferredWidth > 0) {
                    var newWidth = _this.normaliseColumnWidth(column, preferredWidth);
                    column.setActualWidth(newWidth, source);
                    columnsAutosized.push(column);
                    changesThisTimeAround++;
                }
                return true;
            }, source);
        }
        if (columnsAutosized.length) {
            var event_2 = {
                type: events_1.Events.EVENT_COLUMN_RESIZED,
                columns: columnsAutosized,
                column: columnsAutosized.length === 1 ? columnsAutosized[0] : null,
                finished: true,
                api: this.gridApi,
                columnApi: this.columnApi,
                source: "autosizeColumns"
            };
            this.eventService.dispatchEvent(event_2);
        }
    };
    ColumnController.prototype.autoSizeColumn = function (key, skipHeader, source) {
        if (source === void 0) { source = "api"; }
        if (key) {
            this.autoSizeColumns([key], skipHeader, source);
        }
    };
    ColumnController.prototype.autoSizeAllColumns = function (skipHeader, source) {
        if (source === void 0) { source = "api"; }
        var allDisplayedColumns = this.getAllDisplayedColumns();
        this.autoSizeColumns(allDisplayedColumns, skipHeader, source);
    };
    ColumnController.prototype.getColumnsFromTree = function (rootColumns) {
        var result = [];
        var recursiveFindColumns = function (childColumns) {
            for (var i = 0; i < childColumns.length; i++) {
                var child = childColumns[i];
                if (child instanceof column_1.Column) {
                    result.push(child);
                }
                else if (child instanceof originalColumnGroup_1.OriginalColumnGroup) {
                    recursiveFindColumns(child.getChildren());
                }
            }
        };
        recursiveFindColumns(rootColumns);
        return result;
    };
    ColumnController.prototype.getAllDisplayedColumnGroups = function () {
        if (this.displayedLeftColumnTree && this.displayedRightColumnTree && this.displayedCentreColumnTree) {
            return this.displayedLeftColumnTree
                .concat(this.displayedCentreColumnTree)
                .concat(this.displayedRightColumnTree);
        }
        return null;
    };
    // + columnSelectPanel
    ColumnController.prototype.getPrimaryColumnTree = function () {
        return this.primaryColumnTree;
    };
    // + gridPanel -> for resizing the body and setting top margin
    ColumnController.prototype.getHeaderRowCount = function () {
        return this.gridHeaderRowCount;
    };
    // + headerRenderer -> setting pinned body width
    ColumnController.prototype.getLeftDisplayedColumnGroups = function () {
        return this.displayedLeftColumnTree;
    };
    // + headerRenderer -> setting pinned body width
    ColumnController.prototype.getRightDisplayedColumnGroups = function () {
        return this.displayedRightColumnTree;
    };
    // + headerRenderer -> setting pinned body width
    ColumnController.prototype.getCenterDisplayedColumnGroups = function () {
        return this.displayedCentreColumnTree;
    };
    ColumnController.prototype.getDisplayedColumnGroups = function (type) {
        switch (type) {
            case constants_1.Constants.PINNED_LEFT:
                return this.getLeftDisplayedColumnGroups();
            case constants_1.Constants.PINNED_RIGHT:
                return this.getRightDisplayedColumnGroups();
            default:
                return this.getCenterDisplayedColumnGroups();
        }
    };
    // gridPanel -> ensureColumnVisible
    ColumnController.prototype.isColumnDisplayed = function (column) {
        return this.getAllDisplayedColumns().indexOf(column) >= 0;
    };
    // + csvCreator
    ColumnController.prototype.getAllDisplayedColumns = function () {
        return this.allDisplayedColumns;
    };
    ColumnController.prototype.getAllDisplayedVirtualColumns = function () {
        return this.allDisplayedVirtualColumns;
    };
    ColumnController.prototype.getDisplayedLeftColumnsForRow = function (rowNode) {
        if (!this.colSpanActive) {
            return this.displayedLeftColumns;
        }
        return this.getDisplayedColumnsForRow(rowNode, this.displayedLeftColumns);
    };
    ColumnController.prototype.getDisplayedRightColumnsForRow = function (rowNode) {
        if (!this.colSpanActive) {
            return this.displayedRightColumns;
        }
        return this.getDisplayedColumnsForRow(rowNode, this.displayedRightColumns);
    };
    ColumnController.prototype.getDisplayedColumnsForRow = function (rowNode, displayedColumns, filterCallback, emptySpaceBeforeColumn) {
        var result = [];
        var lastConsideredCol = null;
        var _loop_1 = function (i) {
            var col = displayedColumns[i];
            var maxAllowedColSpan = displayedColumns.length - i;
            var colSpan = Math.min(col.getColSpan(rowNode), maxAllowedColSpan);
            var columnsToCheckFilter = [col];
            if (colSpan > 1) {
                var colsToRemove = colSpan - 1;
                for (var j = 1; j <= colsToRemove; j++) {
                    columnsToCheckFilter.push(displayedColumns[i + j]);
                }
                i += colsToRemove;
            }
            // see which cols we should take out for column virtualisation
            var filterPasses;
            if (filterCallback) {
                // if user provided a callback, means some columns may not be in the viewport.
                // the user will NOT provide a callback if we are talking about pinned areas,
                // as pinned areas have no horizontal scroll and do not virtualise the columns.
                // if lots of columns, that means column spanning, and we set filterPasses = true
                // if one or more of the columns spanned pass the filter.
                filterPasses = false;
                columnsToCheckFilter.forEach(function (colForFilter) {
                    if (filterCallback(colForFilter)) {
                        filterPasses = true;
                    }
                });
            }
            else {
                filterPasses = true;
            }
            if (filterPasses) {
                if (result.length === 0 && lastConsideredCol) {
                    var gapBeforeColumn = emptySpaceBeforeColumn ? emptySpaceBeforeColumn(col) : false;
                    if (gapBeforeColumn) {
                        result.push(lastConsideredCol);
                    }
                }
                result.push(col);
            }
            lastConsideredCol = col;
            out_i_1 = i;
        };
        var out_i_1;
        for (var i = 0; i < displayedColumns.length; i++) {
            _loop_1(i);
            i = out_i_1;
        }
        return result;
    };
    // + rowRenderer
    // if we are not column spanning, this just returns back the virtual centre columns,
    // however if we are column spanning, then different rows can have different virtual
    // columns, so we have to work out the list for each individual row.
    ColumnController.prototype.getAllDisplayedCenterVirtualColumnsForRow = function (rowNode) {
        var _this = this;
        if (!this.colSpanActive) {
            return this.allDisplayedCenterVirtualColumns;
        }
        var emptySpaceBeforeColumn = function (col) { return col.getLeft() > _this.viewportLeft; };
        // if doing column virtualisation, then we filter based on the viewport.
        var filterCallback = this.suppressColumnVirtualisation ? null : this.isColumnInViewport.bind(this);
        return this.getDisplayedColumnsForRow(rowNode, this.displayedCenterColumns, filterCallback, emptySpaceBeforeColumn);
    };
    ColumnController.prototype.isColumnInViewport = function (col) {
        var columnLeft = col.getLeft();
        var columnRight = col.getLeft() + col.getActualWidth();
        // adding 200 for buffer size, so some cols off viewport are rendered.
        // this helps horizontal scrolling so user rarely sees white space (unless
        // they scroll horizontally fast). however we are conservative, as the more
        // buffer the slower the vertical redraw speed
        var leftBounds = this.viewportLeft - 200;
        var rightBounds = this.viewportRight + 200;
        var columnToMuchLeft = columnLeft < leftBounds && columnRight < leftBounds;
        var columnToMuchRight = columnLeft > rightBounds && columnRight > rightBounds;
        return !columnToMuchLeft && !columnToMuchRight;
    };
    // used by:
    // + angularGrid -> setting pinned body width
    // note: this should be cached
    ColumnController.prototype.getPinnedLeftContainerWidth = function () {
        return this.getWidthOfColsInList(this.displayedLeftColumns);
    };
    // note: this should be cached
    ColumnController.prototype.getPinnedRightContainerWidth = function () {
        return this.getWidthOfColsInList(this.displayedRightColumns);
    };
    ColumnController.prototype.updatePrimaryColumnList = function (keys, masterList, actionIsAdd, columnCallback, eventType, source) {
        var _this = this;
        if (source === void 0) { source = "api"; }
        if (!keys || utils_1._.missingOrEmpty(keys)) {
            return;
        }
        var atLeastOne = false;
        keys.forEach(function (key) {
            var columnToAdd = _this.getPrimaryColumn(key);
            if (!columnToAdd) {
                return;
            }
            if (actionIsAdd) {
                if (masterList.indexOf(columnToAdd) >= 0) {
                    return;
                }
                masterList.push(columnToAdd);
            }
            else {
                if (masterList.indexOf(columnToAdd) < 0) {
                    return;
                }
                utils_1._.removeFromArray(masterList, columnToAdd);
            }
            columnCallback(columnToAdd);
            atLeastOne = true;
        });
        if (!atLeastOne) {
            return;
        }
        if (this.autoGroupsNeedBuilding) {
            this.updateGridColumns();
        }
        this.updateDisplayedColumns(source);
        var event = {
            type: eventType,
            columns: masterList,
            column: masterList.length === 1 ? masterList[0] : null,
            api: this.gridApi,
            columnApi: this.columnApi,
            source: source
        };
        this.eventService.dispatchEvent(event);
    };
    ColumnController.prototype.setRowGroupColumns = function (colKeys, source) {
        if (source === void 0) { source = "api"; }
        this.autoGroupsNeedBuilding = true;
        this.setPrimaryColumnList(colKeys, this.rowGroupColumns, events_1.Events.EVENT_COLUMN_ROW_GROUP_CHANGED, this.setRowGroupActive.bind(this), source);
    };
    ColumnController.prototype.setRowGroupActive = function (active, column, source) {
        if (active === column.isRowGroupActive()) {
            return;
        }
        column.setRowGroupActive(active, source);
        if (!active && !this.gridOptionsWrapper.isSuppressMakeColumnVisibleAfterUnGroup()) {
            column.setVisible(true, source);
        }
    };
    ColumnController.prototype.addRowGroupColumn = function (key, source) {
        if (source === void 0) { source = "api"; }
        if (key) {
            this.addRowGroupColumns([key], source);
        }
    };
    ColumnController.prototype.addRowGroupColumns = function (keys, source) {
        if (source === void 0) { source = "api"; }
        this.autoGroupsNeedBuilding = true;
        this.updatePrimaryColumnList(keys, this.rowGroupColumns, true, this.setRowGroupActive.bind(this, true), events_1.Events.EVENT_COLUMN_ROW_GROUP_CHANGED, source);
    };
    ColumnController.prototype.removeRowGroupColumns = function (keys, source) {
        if (source === void 0) { source = "api"; }
        this.autoGroupsNeedBuilding = true;
        this.updatePrimaryColumnList(keys, this.rowGroupColumns, false, this.setRowGroupActive.bind(this, false), events_1.Events.EVENT_COLUMN_ROW_GROUP_CHANGED, source);
    };
    ColumnController.prototype.removeRowGroupColumn = function (key, source) {
        if (source === void 0) { source = "api"; }
        if (key) {
            this.removeRowGroupColumns([key], source);
        }
    };
    ColumnController.prototype.addPivotColumns = function (keys, source) {
        if (source === void 0) { source = "api"; }
        this.updatePrimaryColumnList(keys, this.pivotColumns, true, function (column) { return column.setPivotActive(true, source); }, events_1.Events.EVENT_COLUMN_PIVOT_CHANGED, source);
    };
    ColumnController.prototype.setPivotColumns = function (colKeys, source) {
        if (source === void 0) { source = "api"; }
        this.setPrimaryColumnList(colKeys, this.pivotColumns, events_1.Events.EVENT_COLUMN_PIVOT_CHANGED, function (added, column) {
            column.setPivotActive(added, source);
        }, source);
    };
    ColumnController.prototype.addPivotColumn = function (key, source) {
        if (source === void 0) { source = "api"; }
        this.addPivotColumns([key], source);
    };
    ColumnController.prototype.removePivotColumns = function (keys, source) {
        if (source === void 0) { source = "api"; }
        this.updatePrimaryColumnList(keys, this.pivotColumns, false, function (column) { return column.setPivotActive(false, source); }, events_1.Events.EVENT_COLUMN_PIVOT_CHANGED, source);
    };
    ColumnController.prototype.removePivotColumn = function (key, source) {
        if (source === void 0) { source = "api"; }
        this.removePivotColumns([key], source);
    };
    ColumnController.prototype.setPrimaryColumnList = function (colKeys, masterList, eventName, columnCallback, source) {
        var _this = this;
        masterList.length = 0;
        if (utils_1._.exists(colKeys)) {
            colKeys.forEach(function (key) {
                var column = _this.getPrimaryColumn(key);
                if (column) {
                    masterList.push(column);
                }
            });
        }
        this.primaryColumns.forEach(function (column) {
            var added = masterList.indexOf(column) >= 0;
            columnCallback(added, column);
        });
        if (this.autoGroupsNeedBuilding) {
            this.updateGridColumns();
        }
        this.updateDisplayedColumns(source);
        var event = {
            type: eventName,
            columns: masterList,
            column: masterList.length === 1 ? masterList[0] : null,
            api: this.gridApi,
            columnApi: this.columnApi,
            source: source
        };
        this.eventService.dispatchEvent(event);
    };
    ColumnController.prototype.setValueColumns = function (colKeys, source) {
        if (source === void 0) { source = "api"; }
        this.setPrimaryColumnList(colKeys, this.valueColumns, events_1.Events.EVENT_COLUMN_VALUE_CHANGED, this.setValueActive.bind(this), source);
    };
    ColumnController.prototype.setValueActive = function (active, column, source) {
        if (active === column.isValueActive()) {
            return;
        }
        column.setValueActive(active, source);
        if (active && !column.getAggFunc()) {
            var defaultAggFunc = this.aggFuncService.getDefaultAggFunc(column);
            column.setAggFunc(defaultAggFunc);
        }
    };
    ColumnController.prototype.addValueColumns = function (keys, source) {
        if (source === void 0) { source = "api"; }
        this.updatePrimaryColumnList(keys, this.valueColumns, true, this.setValueActive.bind(this, true), events_1.Events.EVENT_COLUMN_VALUE_CHANGED, source);
    };
    ColumnController.prototype.addValueColumn = function (colKey, source) {
        if (source === void 0) { source = "api"; }
        if (colKey) {
            this.addValueColumns([colKey], source);
        }
    };
    ColumnController.prototype.removeValueColumn = function (colKey, source) {
        if (source === void 0) { source = "api"; }
        this.removeValueColumns([colKey], source);
    };
    ColumnController.prototype.removeValueColumns = function (keys, source) {
        if (source === void 0) { source = "api"; }
        this.updatePrimaryColumnList(keys, this.valueColumns, false, this.setValueActive.bind(this, false), events_1.Events.EVENT_COLUMN_VALUE_CHANGED, source);
    };
    // returns the width we can set to this col, taking into consideration min and max widths
    ColumnController.prototype.normaliseColumnWidth = function (column, newWidth) {
        if (newWidth < column.getMinWidth()) {
            newWidth = column.getMinWidth();
        }
        if (column.isGreaterThanMax(newWidth)) {
            newWidth = column.getMaxWidth();
        }
        return newWidth;
    };
    ColumnController.prototype.getPrimaryOrGridColumn = function (key) {
        var column = this.getPrimaryColumn(key);
        return column || this.getGridColumn(key);
    };
    ColumnController.prototype.setColumnWidths = function (columnWidths, shiftKey, // @takeFromAdjacent - if user has 'shift' pressed, then pixels are taken from adjacent column
    finished, // @finished - ends up in the event, tells the user if more events are to come
    source) {
        var _this = this;
        if (source === void 0) { source = "api"; }
        var sets = [];
        columnWidths.forEach(function (columnWidth) {
            var col = _this.getPrimaryOrGridColumn(columnWidth.key);
            if (!col) {
                return;
            }
            sets.push({
                width: columnWidth.newWidth,
                ratios: [1],
                columns: [col]
            });
            // if user wants to do shift resize by default, then we invert the shift operation
            var defaultIsShift = _this.gridOptionsWrapper.getColResizeDefault() === 'shift';
            if (defaultIsShift) {
                shiftKey = !shiftKey;
            }
            if (shiftKey) {
                var otherCol = _this.getDisplayedColAfter(col);
                if (!otherCol) {
                    return;
                }
                var widthDiff = col.getActualWidth() - columnWidth.newWidth;
                var otherColWidth = otherCol.getActualWidth() + widthDiff;
                sets.push({
                    width: otherColWidth,
                    ratios: [1],
                    columns: [otherCol]
                });
            }
        });
        if (sets.length === 0) {
            return;
        }
        this.resizeColumnSets(sets, finished, source);
        if (this.flexActive) {
            this.refreshFlexedColumns();
        }
    };
    ColumnController.prototype.checkMinAndMaxWidthsForSet = function (columnResizeSet) {
        var columns = columnResizeSet.columns, width = columnResizeSet.width;
        // every col has a min width, so sum them all up and see if we have enough room
        // for all the min widths
        var minWidthAccumulated = 0;
        var maxWidthAccumulated = 0;
        var maxWidthActive = true;
        columns.forEach(function (col) {
            minWidthAccumulated += col.getMinWidth();
            if (col.getMaxWidth() > 0) {
                maxWidthAccumulated += col.getMaxWidth();
            }
            else {
                // if at least one columns has no max width, it means the group of columns
                // then has no max width, as at least one column can take as much width as possible
                maxWidthActive = false;
            }
        });
        var minWidthPasses = width >= minWidthAccumulated;
        var maxWidthPasses = !maxWidthActive || (width <= maxWidthAccumulated);
        return minWidthPasses && maxWidthPasses;
    };
    // method takes sets of columns and resizes them. either all sets will be resized, or nothing
    // be resized. this is used for example when user tries to resize a group and holds shift key,
    // then both the current group (grows), and the adjacent group (shrinks), will get resized,
    // so that's two sets for this method.
    ColumnController.prototype.resizeColumnSets = function (resizeSets, finished, source) {
        var passMinMaxCheck = !resizeSets || resizeSets.every(this.checkMinAndMaxWidthsForSet.bind(this));
        if (!passMinMaxCheck) {
            // even though we are not going to resize beyond min/max size, we still need to raise event when finished
            if (finished) {
                var columns = resizeSets && resizeSets.length > 0 ? resizeSets[0].columns : null;
                var event_3 = {
                    type: events_1.Events.EVENT_COLUMN_RESIZED,
                    columns: columns,
                    column: columns && columns.length === 1 ? columns[0] : null,
                    finished: finished,
                    api: this.gridApi,
                    columnApi: this.columnApi,
                    source: source
                };
                this.eventService.dispatchEvent(event_3);
            }
            return; // don't resize!
        }
        var changedCols = [];
        var allCols = [];
        resizeSets.forEach(function (set) {
            var width = set.width, columns = set.columns, ratios = set.ratios;
            // keep track of pixels used, and last column gets the remaining,
            // to cater for rounding errors, and min width adjustments
            var newWidths = {};
            var finishedCols = {};
            columns.forEach(function (col) { return allCols.push(col); });
            // the loop below goes through each col. if a col exceeds it's min/max width,
            // it then gets set to its min/max width and the column is removed marked as 'finished'
            // and the calculation is done again leaving this column out. take for example columns
            // {A, width: 50, maxWidth: 100}
            // {B, width: 50}
            // {C, width: 50}
            // and then the set is set to width 600 - on the first pass the grid tries to set each column
            // to 200. it checks A and sees 200 > 100 and so sets the width to 100. col A is then marked
            // as 'finished' and the calculation is done again with the remaining cols B and C, which end up
            // splitting the remaining 500 pixels.
            var finishedColsGrew = true;
            var loopCount = 0;
            var _loop_2 = function () {
                loopCount++;
                if (loopCount > 1000) {
                    // this should never happen, but in the future, someone might introduce a bug here,
                    // so we stop the browser from hanging and report bug properly
                    console.error('ag-Grid: infinite loop in resizeColumnSets');
                    return "break";
                }
                finishedColsGrew = false;
                var subsetCols = [];
                var subsetRatios = [];
                var subsetRatioTotal = 0;
                var pixelsToDistribute = width;
                columns.forEach(function (col, index) {
                    var thisColFinished = finishedCols[col.getId()];
                    if (thisColFinished) {
                        pixelsToDistribute -= newWidths[col.getId()];
                    }
                    else {
                        subsetCols.push(col);
                        var ratioThisCol = ratios[index];
                        subsetRatioTotal += ratioThisCol;
                        subsetRatios.push(ratioThisCol);
                    }
                });
                // because we are not using all of the ratios (cols can be missing),
                // we scale the ratio. if all columns are included, then subsetRatioTotal=1,
                // and so the ratioScale will be 1.
                var ratioScale = 1 / subsetRatioTotal;
                subsetCols.forEach(function (col, index) {
                    var lastCol = index === (subsetCols.length - 1);
                    var colNewWidth;
                    if (lastCol) {
                        colNewWidth = pixelsToDistribute;
                    }
                    else {
                        colNewWidth = Math.round(ratios[index] * width * ratioScale);
                        pixelsToDistribute -= colNewWidth;
                    }
                    if (colNewWidth < col.getMinWidth()) {
                        colNewWidth = col.getMinWidth();
                        finishedCols[col.getId()] = true;
                        finishedColsGrew = true;
                    }
                    else if (col.getMaxWidth() > 0 && colNewWidth > col.getMaxWidth()) {
                        colNewWidth = col.getMaxWidth();
                        finishedCols[col.getId()] = true;
                        finishedColsGrew = true;
                    }
                    newWidths[col.getId()] = colNewWidth;
                });
            };
            while (finishedColsGrew) {
                var state_1 = _loop_2();
                if (state_1 === "break")
                    break;
            }
            columns.forEach(function (col) {
                var newWidth = newWidths[col.getId()];
                if (col.getActualWidth() !== newWidth) {
                    col.setActualWidth(newWidth, source);
                    changedCols.push(col);
                }
            });
        });
        // if no cols changed, then no need to update more or send event.
        var atLeastOneColChanged = changedCols.length > 0;
        if (atLeastOneColChanged) {
            this.setLeftValues(source);
            this.updateBodyWidths();
            this.checkDisplayedVirtualColumns();
        }
        // check for change first, to avoid unnecessary firing of events
        // however we always fire 'finished' events. this is important
        // when groups are resized, as if the group is changing slowly,
        // eg 1 pixel at a time, then each change will fire change events
        // in all the columns in the group, but only one with get the pixel.
        if (atLeastOneColChanged || finished) {
            var event_4 = {
                type: events_1.Events.EVENT_COLUMN_RESIZED,
                columns: allCols,
                column: allCols.length === 1 ? allCols[0] : null,
                finished: finished,
                api: this.gridApi,
                columnApi: this.columnApi,
                source: source
            };
            this.eventService.dispatchEvent(event_4);
        }
    };
    ColumnController.prototype.setColumnAggFunc = function (column, aggFunc, source) {
        if (source === void 0) { source = "api"; }
        if (!column) {
            return;
        }
        column.setAggFunc(aggFunc);
        var event = {
            type: events_1.Events.EVENT_COLUMN_VALUE_CHANGED,
            columns: [column],
            column: column,
            api: this.gridApi,
            columnApi: this.columnApi,
            source: source
        };
        this.eventService.dispatchEvent(event);
    };
    ColumnController.prototype.moveRowGroupColumn = function (fromIndex, toIndex, source) {
        if (source === void 0) { source = "api"; }
        var column = this.rowGroupColumns[fromIndex];
        this.rowGroupColumns.splice(fromIndex, 1);
        this.rowGroupColumns.splice(toIndex, 0, column);
        var event = {
            type: events_1.Events.EVENT_COLUMN_ROW_GROUP_CHANGED,
            columns: this.rowGroupColumns,
            column: this.rowGroupColumns.length === 1 ? this.rowGroupColumns[0] : null,
            api: this.gridApi,
            columnApi: this.columnApi,
            source: source
        };
        this.eventService.dispatchEvent(event);
    };
    ColumnController.prototype.moveColumns = function (columnsToMoveKeys, toIndex, source) {
        if (source === void 0) { source = "api"; }
        this.columnAnimationService.start();
        if (toIndex > this.gridColumns.length - columnsToMoveKeys.length) {
            console.warn('ag-Grid: tried to insert columns in invalid location, toIndex = ' + toIndex);
            console.warn('ag-Grid: remember that you should not count the moving columns when calculating the new index');
            return;
        }
        // we want to pull all the columns out first and put them into an ordered list
        var columnsToMove = this.getGridColumns(columnsToMoveKeys);
        var failedRules = !this.doesMovePassRules(columnsToMove, toIndex);
        if (failedRules) {
            return;
        }
        utils_1._.moveInArray(this.gridColumns, columnsToMove, toIndex);
        this.updateDisplayedColumns(source);
        var event = {
            type: events_1.Events.EVENT_COLUMN_MOVED,
            columns: columnsToMove,
            column: columnsToMove.length === 1 ? columnsToMove[0] : null,
            toIndex: toIndex,
            api: this.gridApi,
            columnApi: this.columnApi,
            source: source
        };
        this.eventService.dispatchEvent(event);
        this.columnAnimationService.finish();
    };
    ColumnController.prototype.doesMovePassRules = function (columnsToMove, toIndex) {
        // make a copy of what the grid columns would look like after the move
        var proposedColumnOrder = this.gridColumns.slice();
        utils_1._.moveInArray(proposedColumnOrder, columnsToMove, toIndex);
        // then check that the new proposed order of the columns passes all rules
        if (!this.doesMovePassMarryChildren(proposedColumnOrder)) {
            return false;
        }
        if (!this.doesMovePassLockedPositions(proposedColumnOrder)) {
            return false;
        }
        return true;
    };
    ColumnController.prototype.doesMovePassLockedPositions = function (proposedColumnOrder) {
        var foundNonLocked = false;
        var rulePassed = true;
        // go though the cols, see if any non-locked appear before any locked
        proposedColumnOrder.forEach(function (col) {
            if (col.getColDef().lockPosition) {
                if (foundNonLocked) {
                    rulePassed = false;
                }
            }
            else {
                foundNonLocked = true;
            }
        });
        return rulePassed;
    };
    ColumnController.prototype.doesMovePassMarryChildren = function (allColumnsCopy) {
        var rulePassed = true;
        this.columnUtils.depthFirstOriginalTreeSearch(null, this.gridBalancedTree, function (child) {
            if (!(child instanceof originalColumnGroup_1.OriginalColumnGroup)) {
                return;
            }
            var columnGroup = child;
            var marryChildren = columnGroup.getColGroupDef() && columnGroup.getColGroupDef().marryChildren;
            if (!marryChildren) {
                return;
            }
            var newIndexes = [];
            columnGroup.getLeafColumns().forEach(function (col) {
                var newColIndex = allColumnsCopy.indexOf(col);
                newIndexes.push(newColIndex);
            });
            var maxIndex = Math.max.apply(Math, newIndexes);
            var minIndex = Math.min.apply(Math, newIndexes);
            // spread is how far the first column in this group is away from the last column
            var spread = maxIndex - minIndex;
            var maxSpread = columnGroup.getLeafColumns().length - 1;
            // if the columns
            if (spread > maxSpread) {
                rulePassed = false;
            }
            // console.log(`maxIndex = ${maxIndex}, minIndex = ${minIndex}, spread = ${spread}, maxSpread = ${maxSpread}, fail = ${spread > (count-1)}`)
            // console.log(allColumnsCopy.map( col => col.getColDef().field).join(','));
        });
        return rulePassed;
    };
    ColumnController.prototype.moveColumn = function (key, toIndex, source) {
        if (source === void 0) { source = "api"; }
        this.moveColumns([key], toIndex, source);
    };
    ColumnController.prototype.moveColumnByIndex = function (fromIndex, toIndex, source) {
        if (source === void 0) { source = "api"; }
        var column = this.gridColumns[fromIndex];
        this.moveColumn(column, toIndex, source);
    };
    // used by:
    // + angularGrid -> for setting body width
    // + rowController -> setting main row widths (when inserting and resizing)
    // need to cache this
    ColumnController.prototype.getBodyContainerWidth = function () {
        return this.bodyWidth;
    };
    ColumnController.prototype.getContainerWidth = function (pinned) {
        switch (pinned) {
            case constants_1.Constants.PINNED_LEFT:
                return this.leftWidth;
            case constants_1.Constants.PINNED_RIGHT:
                return this.rightWidth;
            default:
                return this.bodyWidth;
        }
    };
    // after setColumnWidth or updateGroupsAndDisplayedColumns
    ColumnController.prototype.updateBodyWidths = function () {
        var newBodyWidth = this.getWidthOfColsInList(this.displayedCenterColumns);
        var newLeftWidth = this.getWidthOfColsInList(this.displayedLeftColumns);
        var newRightWidth = this.getWidthOfColsInList(this.displayedRightColumns);
        // this is used by virtual col calculation, for RTL only, as a change to body width can impact displayed
        // columns, due to RTL inverting the y coordinates
        this.bodyWidthDirty = this.bodyWidth !== newBodyWidth;
        var atLeastOneChanged = this.bodyWidth !== newBodyWidth || this.leftWidth !== newLeftWidth || this.rightWidth !== newRightWidth;
        if (atLeastOneChanged) {
            this.bodyWidth = newBodyWidth;
            this.leftWidth = newLeftWidth;
            this.rightWidth = newRightWidth;
            // when this fires, it is picked up by the gridPanel, which ends up in
            // gridPanel calling setWidthAndScrollPosition(), which in turn calls setVirtualViewportPosition()
            var event_5 = {
                type: events_1.Events.EVENT_DISPLAYED_COLUMNS_WIDTH_CHANGED,
                api: this.gridApi,
                columnApi: this.columnApi
            };
            this.eventService.dispatchEvent(event_5);
        }
    };
    // + rowController
    ColumnController.prototype.getValueColumns = function () {
        return this.valueColumns ? this.valueColumns : [];
    };
    // + rowController
    ColumnController.prototype.getPivotColumns = function () {
        return this.pivotColumns ? this.pivotColumns : [];
    };
    // + clientSideRowModel
    ColumnController.prototype.isPivotActive = function () {
        return this.pivotColumns && this.pivotColumns.length > 0 && this.pivotMode;
    };
    // + toolPanel
    ColumnController.prototype.getRowGroupColumns = function () {
        return this.rowGroupColumns ? this.rowGroupColumns : [];
    };
    // + rowController -> while inserting rows
    ColumnController.prototype.getDisplayedCenterColumns = function () {
        return this.displayedCenterColumns;
    };
    // + rowController -> while inserting rows
    ColumnController.prototype.getDisplayedLeftColumns = function () {
        return this.displayedLeftColumns;
    };
    ColumnController.prototype.getDisplayedRightColumns = function () {
        return this.displayedRightColumns;
    };
    ColumnController.prototype.getDisplayedColumns = function (type) {
        switch (type) {
            case constants_1.Constants.PINNED_LEFT:
                return this.getDisplayedLeftColumns();
            case constants_1.Constants.PINNED_RIGHT:
                return this.getDisplayedRightColumns();
            default:
                return this.getDisplayedCenterColumns();
        }
    };
    // used by:
    // + clientSideRowController -> sorting, building quick filter text
    // + headerRenderer -> sorting (clearing icon)
    ColumnController.prototype.getAllPrimaryColumns = function () {
        return this.primaryColumns ? this.primaryColumns.slice() : null;
    };
    ColumnController.prototype.getSecondaryColumns = function () {
        return this.secondaryColumns ? this.secondaryColumns.slice() : null;
    };
    ColumnController.prototype.getAllColumnsForQuickFilter = function () {
        return this.columnsForQuickFilter;
    };
    // + moveColumnController
    ColumnController.prototype.getAllGridColumns = function () {
        return this.gridColumns;
    };
    ColumnController.prototype.isEmpty = function () {
        return utils_1._.missingOrEmpty(this.gridColumns);
    };
    ColumnController.prototype.isRowGroupEmpty = function () {
        return utils_1._.missingOrEmpty(this.rowGroupColumns);
    };
    ColumnController.prototype.setColumnVisible = function (key, visible, source) {
        if (source === void 0) { source = "api"; }
        this.setColumnsVisible([key], visible, source);
    };
    ColumnController.prototype.setColumnsVisible = function (keys, visible, source) {
        var _this = this;
        if (source === void 0) { source = "api"; }
        this.columnAnimationService.start();
        this.actionOnGridColumns(keys, function (column) {
            if (column.isVisible() !== visible) {
                column.setVisible(visible, source);
                return true;
            }
            return false;
        }, source, function () {
            var event = {
                type: events_1.Events.EVENT_COLUMN_VISIBLE,
                visible: visible,
                column: null,
                columns: null,
                api: _this.gridApi,
                columnApi: _this.columnApi,
                source: source
            };
            return event;
        });
        this.columnAnimationService.finish();
    };
    ColumnController.prototype.setColumnPinned = function (key, pinned, source) {
        if (source === void 0) { source = "api"; }
        if (key) {
            this.setColumnsPinned([key], pinned, source);
        }
    };
    ColumnController.prototype.setColumnsPinned = function (keys, pinned, source) {
        var _this = this;
        if (source === void 0) { source = "api"; }
        if (this.gridOptionsWrapper.getDomLayout() === 'print') {
            console.warn("Changing the column pinning status is not allowed with domLayout='print'");
            return;
        }
        this.columnAnimationService.start();
        var actualPinned;
        if (pinned === true || pinned === constants_1.Constants.PINNED_LEFT) {
            actualPinned = constants_1.Constants.PINNED_LEFT;
        }
        else if (pinned === constants_1.Constants.PINNED_RIGHT) {
            actualPinned = constants_1.Constants.PINNED_RIGHT;
        }
        else {
            actualPinned = null;
        }
        this.actionOnGridColumns(keys, function (col) {
            if (col.getPinned() !== actualPinned) {
                col.setPinned(actualPinned);
                return true;
            }
            return false;
        }, source, function () {
            var event = {
                type: events_1.Events.EVENT_COLUMN_PINNED,
                pinned: actualPinned,
                column: null,
                columns: null,
                api: _this.gridApi,
                columnApi: _this.columnApi,
                source: source
            };
            return event;
        });
        this.columnAnimationService.finish();
    };
    // does an action on a set of columns. provides common functionality for looking up the
    // columns based on key, getting a list of effected columns, and then updated the event
    // with either one column (if it was just one col) or a list of columns
    // used by: autoResize, setVisible, setPinned
    ColumnController.prototype.actionOnGridColumns = function (// the column keys this action will be on
    keys, 
    // the action to do - if this returns false, the column was skipped
    // and won't be included in the event
    action, 
    // should return back a column event of the right type
    source, createEvent) {
        var _this = this;
        if (utils_1._.missingOrEmpty(keys)) {
            return;
        }
        var updatedColumns = [];
        keys.forEach(function (key) {
            var column = _this.getGridColumn(key);
            if (!column) {
                return;
            }
            // need to check for false with type (ie !== instead of !=)
            // as not returning anything (undefined) would also be false
            var resultOfAction = action(column);
            if (resultOfAction !== false) {
                updatedColumns.push(column);
            }
        });
        if (!updatedColumns.length) {
            return;
        }
        this.updateDisplayedColumns(source);
        if (utils_1._.exists(createEvent) && createEvent) {
            var event_6 = createEvent();
            event_6.columns = updatedColumns;
            event_6.column = updatedColumns.length === 1 ? updatedColumns[0] : null;
            this.eventService.dispatchEvent(event_6);
        }
    };
    ColumnController.prototype.getDisplayedColBefore = function (col) {
        var allDisplayedColumns = this.getAllDisplayedColumns();
        var oldIndex = allDisplayedColumns.indexOf(col);
        if (oldIndex > 0) {
            return allDisplayedColumns[oldIndex - 1];
        }
        return null;
    };
    // used by:
    // + rowRenderer -> for navigation
    ColumnController.prototype.getDisplayedColAfter = function (col) {
        var allDisplayedColumns = this.getAllDisplayedColumns();
        var oldIndex = allDisplayedColumns.indexOf(col);
        if (oldIndex < (allDisplayedColumns.length - 1)) {
            return allDisplayedColumns[oldIndex + 1];
        }
        return null;
    };
    ColumnController.prototype.getDisplayedGroupAfter = function (columnGroup) {
        return this.getDisplayedGroupAtDirection(columnGroup, 'After');
    };
    ColumnController.prototype.getDisplayedGroupBefore = function (columnGroup) {
        return this.getDisplayedGroupAtDirection(columnGroup, 'Before');
    };
    ColumnController.prototype.getDisplayedGroupAtDirection = function (columnGroup, direction) {
        // pick the last displayed column in this group
        var requiredLevel = columnGroup.getOriginalColumnGroup().getLevel() + columnGroup.getPaddingLevel();
        var colGroupLeafColumns = columnGroup.getDisplayedLeafColumns();
        var col = direction === 'After' ? utils_1._.last(colGroupLeafColumns) : colGroupLeafColumns[0];
        var getDisplayColMethod = "getDisplayedCol" + direction;
        while (true) {
            // keep moving to the next col, until we get to another group
            var column = this[getDisplayColMethod](col);
            if (!column) {
                return null;
            }
            var groupPointer = this.getColumnGroupAtLevel(column, requiredLevel);
            if (groupPointer !== columnGroup) {
                return groupPointer;
            }
        }
    };
    ColumnController.prototype.getColumnGroupAtLevel = function (column, level) {
        // get group at same level as the one we are looking for
        var groupPointer = column.getParent();
        var originalGroupLevel;
        var groupPointerLevel;
        while (true) {
            var groupPointerOriginalColumnGroup = groupPointer.getOriginalColumnGroup();
            originalGroupLevel = groupPointerOriginalColumnGroup.getLevel();
            groupPointerLevel = groupPointer.getPaddingLevel();
            if (originalGroupLevel + groupPointerLevel <= level) {
                break;
            }
            groupPointer = groupPointer.getParent();
        }
        return groupPointer;
    };
    ColumnController.prototype.isPinningLeft = function () {
        return this.displayedLeftColumns.length > 0;
    };
    ColumnController.prototype.isPinningRight = function () {
        return this.displayedRightColumns.length > 0;
    };
    ColumnController.prototype.getPrimaryAndSecondaryAndAutoColumns = function () {
        var result = this.primaryColumns ? this.primaryColumns.slice(0) : [];
        if (this.groupAutoColumns && utils_1._.exists(this.groupAutoColumns)) {
            this.groupAutoColumns.forEach(function (col) { return result.push(col); });
        }
        if (this.secondaryColumnsPresent && this.secondaryColumns) {
            this.secondaryColumns.forEach(function (column) { return result.push(column); });
        }
        return result;
    };
    ColumnController.prototype.createStateItemFromColumn = function (column) {
        var rowGroupIndex = column.isRowGroupActive() ? this.rowGroupColumns.indexOf(column) : null;
        var pivotIndex = column.isPivotActive() ? this.pivotColumns.indexOf(column) : null;
        var aggFunc = column.isValueActive() ? column.getAggFunc() : null;
        return {
            colId: column.getColId(),
            hide: !column.isVisible(),
            aggFunc: aggFunc,
            width: column.getActualWidth(),
            pivotIndex: pivotIndex,
            pinned: column.getPinned(),
            rowGroupIndex: rowGroupIndex,
            flex: column.getFlex()
        };
    };
    ColumnController.prototype.getColumnState = function () {
        if (utils_1._.missing(this.primaryColumns)) {
            return [];
        }
        var primaryColumnState = this.primaryColumns.map(this.createStateItemFromColumn.bind(this));
        var groupAutoColumnState = this.groupAutoColumns
            // if groupAutoCols, then include them
            ? this.groupAutoColumns.map(this.createStateItemFromColumn.bind(this))
            // otherwise no
            : [];
        var columnStateList = groupAutoColumnState.concat(primaryColumnState);
        if (!this.pivotMode) {
            this.orderColumnStateList(columnStateList);
        }
        return columnStateList;
    };
    ColumnController.prototype.orderColumnStateList = function (columnStateList) {
        var gridColumnIds = this.gridColumns.map(function (column) { return column.getColId(); });
        columnStateList.sort(function (itemA, itemB) {
            var posA = gridColumnIds.indexOf(itemA.colId);
            var posB = gridColumnIds.indexOf(itemB.colId);
            return posA - posB;
        });
    };
    ColumnController.prototype.resetColumnState = function (suppressEverythingEvent, source) {
        // NOTE = there is one bug here that no customer has noticed - if a column has colDef.lockPosition,
        // this is ignored  below when ordering the cols. to work, we should always put lockPosition cols first.
        // As a work around, developers should just put lockPosition columns first in their colDef list.
        if (suppressEverythingEvent === void 0) { suppressEverythingEvent = false; }
        if (source === void 0) { source = "api"; }
        // we can't use 'allColumns' as the order might of messed up, so get the primary ordered list
        var primaryColumns = this.getColumnsFromTree(this.primaryColumnTree);
        var columnStates = [];
        // we start at 1000, so if user has mix of rowGroup and group specified, it will work with both.
        // eg IF user has ColA.rowGroupIndex=0, ColB.rowGroupIndex=1, ColC.rowGroup=true,
        // THEN result will be ColA.rowGroupIndex=0, ColB.rowGroupIndex=1, ColC.rowGroup=1000
        var letRowGroupIndex = 1000;
        var letPivotIndex = 1000;
        if (primaryColumns) {
            primaryColumns.forEach(function (column) {
                var rowGroupIndex = column.getColDef().rowGroupIndex;
                var rowGroup = column.getColDef().rowGroup;
                var pivotIndex = column.getColDef().pivotIndex;
                var pivot = column.getColDef().pivot;
                var stateItem = {
                    colId: column.getColId(),
                    aggFunc: column.getColDef().aggFunc,
                    hide: column.getColDef().hide,
                    pinned: column.getColDef().pinned,
                    rowGroupIndex: rowGroupIndex,
                    pivotIndex: column.getColDef().pivotIndex,
                    width: column.getColDef().width
                };
                if (utils_1._.missing(rowGroupIndex) && rowGroup) {
                    stateItem.rowGroupIndex = letRowGroupIndex++;
                }
                if (utils_1._.missing(pivotIndex) && pivot) {
                    stateItem.pivotIndex = letPivotIndex++;
                }
                columnStates.push(stateItem);
            });
        }
        this.setColumnState(columnStates, suppressEverythingEvent, source);
    };
    ColumnController.prototype.setColumnState = function (columnStates, suppressEverythingEvent, source) {
        var _this = this;
        if (suppressEverythingEvent === void 0) { suppressEverythingEvent = false; }
        if (source === void 0) { source = "api"; }
        if (utils_1._.missingOrEmpty(this.primaryColumns)) {
            return false;
        }
        var columnStateBefore = this.getColumnState();
        this.autoGroupsNeedBuilding = true;
        // at the end below, this list will have all columns we got no state for
        var columnsWithNoState = this.primaryColumns.slice();
        this.rowGroupColumns = [];
        this.valueColumns = [];
        this.pivotColumns = [];
        var success = true;
        var rowGroupIndexes = {};
        var pivotIndexes = {};
        var autoGroupColumnStates = [];
        if (columnStates) {
            columnStates.forEach(function (state) {
                // auto group columns are re-created so deferring syncing with ColumnState
                if (utils_1._.exists(_this.getAutoColumn(state.colId))) {
                    autoGroupColumnStates.push(state);
                    return;
                }
                var column = _this.getPrimaryColumn(state.colId);
                if (!column) {
                    console.warn('ag-grid: column ' + state.colId + ' not found');
                    success = false;
                }
                else {
                    _this.syncColumnWithStateItem(column, state, rowGroupIndexes, pivotIndexes, source);
                    utils_1._.removeFromArray(columnsWithNoState, column);
                }
            });
            if (this.flexActive) {
                this.refreshFlexedColumns(undefined, undefined, true);
            }
        }
        // anything left over, we got no data for, so add in the column as non-value, non-rowGroup and hidden
        columnsWithNoState.forEach(this.syncColumnWithNoState.bind(this));
        // sort the lists according to the indexes that were provided
        this.rowGroupColumns.sort(this.sortColumnListUsingIndexes.bind(this, rowGroupIndexes));
        this.pivotColumns.sort(this.sortColumnListUsingIndexes.bind(this, pivotIndexes));
        this.updateGridColumns();
        // sync newly created auto group columns with ColumnState
        autoGroupColumnStates.forEach(function (stateItem) {
            var autoCol = _this.getAutoColumn(stateItem.colId);
            _this.syncColumnWithStateItem(autoCol, stateItem, rowGroupIndexes, pivotIndexes, source);
        });
        if (columnStates) {
            var orderOfColIds_1 = columnStates.map(function (stateItem) { return stateItem.colId; });
            this.gridColumns.sort(function (colA, colB) {
                var indexA = orderOfColIds_1.indexOf(colA.getId());
                var indexB = orderOfColIds_1.indexOf(colB.getId());
                return indexA - indexB;
            });
        }
        // this is already done in updateGridColumns, however we changed the order above (to match the order of the state
        // columns) so we need to do it again. we could of put logic into the order above to take into account fixed
        // columns, however if we did then we would have logic for updating fixed columns twice. reusing the logic here
        // is less sexy for the code here, but it keeps consistency.
        this.putFixedColumnsFirst();
        this.updateDisplayedColumns(source);
        if (!suppressEverythingEvent) {
            var event_7 = {
                type: events_1.Events.EVENT_COLUMN_EVERYTHING_CHANGED,
                api: this.gridApi,
                columnApi: this.columnApi,
                source: source
            };
            this.eventService.dispatchEvent(event_7);
        }
        this.raiseColumnEvents(columnStateBefore, source);
        return success;
    };
    ColumnController.prototype.raiseColumnEvents = function (columnStateBefore, source) {
        var _this = this;
        if (this.gridOptionsWrapper.isSuppressSetColumnStateEvents()) {
            return;
        }
        var columnStateAfter = this.getColumnState();
        // raises generic ColumnEvents where all columns are returned rather than what has changed
        var raiseEventWithAllColumns = function (eventType, idMapper, columns) {
            var unchanged = array_1.areEqual(columnStateBefore.map(idMapper).sort(), columnStateAfter.map(idMapper).sort());
            if (unchanged) {
                return;
            }
            // returning all columns rather than what has changed!
            var event = {
                type: eventType,
                columns: columns,
                column: columns.length === 1 ? columns[0] : null,
                api: _this.gridApi,
                columnApi: _this.columnApi,
                source: source
            };
            _this.eventService.dispatchEvent(event);
        };
        // determines which columns have changed according to supplied predicate
        var getChangedColumns = function (changedPredicate) {
            var changedColumns = [];
            var columnStateBeforeMap = {};
            columnStateBefore.forEach(function (col) {
                columnStateBeforeMap[col.colId] = col;
            });
            _this.gridColumns.forEach(function (column) {
                var colStateBefore = columnStateBeforeMap[column.getColId()];
                if (!colStateBefore || changedPredicate(colStateBefore, column)) {
                    changedColumns.push(column);
                }
            });
            return changedColumns;
        };
        // generic ColumnEvents which return current column list
        var valueColumnIdMapper = function (cs) { return cs.colId + '-' + cs.aggFunc; };
        raiseEventWithAllColumns(events_1.Events.EVENT_COLUMN_VALUE_CHANGED, valueColumnIdMapper, this.valueColumns);
        var pivotColumnIdMapper = function (cs) { return cs.colId + '-' + cs.pivotIndex; };
        raiseEventWithAllColumns(events_1.Events.EVENT_COLUMN_PIVOT_CHANGED, pivotColumnIdMapper, this.pivotColumns);
        var rowGroupColumnIdMapper = function (cs) { return cs.colId + '-' + cs.rowGroupIndex; };
        raiseEventWithAllColumns(events_1.Events.EVENT_COLUMN_ROW_GROUP_CHANGED, rowGroupColumnIdMapper, this.rowGroupColumns);
        // specific ColumnEvents which return what's changed
        var pinnedChangePredicate = function (cs, c) { return cs.pinned !== c.getPinned(); };
        this.raiseColumnPinnedEvent(getChangedColumns(pinnedChangePredicate), source);
        var visibilityChangePredicate = function (cs, c) { return cs.hide === c.isVisible(); };
        var cols = getChangedColumns(visibilityChangePredicate);
        this.raiseColumnVisibleEvent(cols, source);
        var resizeChangePredicate = function (cs, c) { return cs.width !== c.getActualWidth(); };
        this.raiseColumnResizeEvent(getChangedColumns(resizeChangePredicate), source);
        // special handling for moved column events
        this.raiseColumnMovedEvent(columnStateBefore, source);
    };
    ColumnController.prototype.raiseColumnPinnedEvent = function (changedColumns, source) {
        if (!changedColumns.length) {
            return;
        }
        var event = {
            type: events_1.Events.EVENT_COLUMN_PINNED,
            pinned: null,
            columns: changedColumns,
            column: null,
            api: this.gridApi,
            columnApi: this.columnApi,
            source: source
        };
        this.eventService.dispatchEvent(event);
    };
    ColumnController.prototype.raiseColumnVisibleEvent = function (changedColumns, source) {
        if (!changedColumns.length) {
            return;
        }
        var event = {
            type: events_1.Events.EVENT_COLUMN_VISIBLE,
            visible: undefined,
            columns: changedColumns,
            column: null,
            api: this.gridApi,
            columnApi: this.columnApi,
            source: source
        };
        this.eventService.dispatchEvent(event);
    };
    ColumnController.prototype.raiseColumnResizeEvent = function (changedColumns, source) {
        if (!changedColumns.length) {
            return;
        }
        var event = {
            type: events_1.Events.EVENT_COLUMN_RESIZED,
            columns: changedColumns,
            column: null,
            finished: true,
            api: this.gridApi,
            columnApi: this.columnApi,
            source: source
        };
        this.eventService.dispatchEvent(event);
    };
    ColumnController.prototype.raiseColumnMovedEvent = function (columnStateBefore, source) {
        var movedColumns = [];
        var columnStateAfter = this.getColumnState();
        var _loop_3 = function (i) {
            var before = columnStateBefore[i];
            var after = columnStateAfter[i];
            // don't consider column if reintroduced or hidden
            if (!before || after.hide) {
                return "continue";
            }
            if (before.colId !== after.colId) {
                var predicate = function (column) { return column.getColId() === after.colId; };
                var movedColumn = utils_1._.find(this_1.allDisplayedColumns, predicate);
                movedColumns.push(movedColumn);
            }
        };
        var this_1 = this;
        for (var i = 0; i < columnStateAfter.length; i++) {
            _loop_3(i);
        }
        if (!movedColumns.length) {
            return;
        }
        var event = {
            type: events_1.Events.EVENT_COLUMN_MOVED,
            columns: movedColumns,
            column: null,
            toIndex: undefined,
            api: this.gridApi,
            columnApi: this.columnApi,
            source: source
        };
        this.eventService.dispatchEvent(event);
    };
    ColumnController.prototype.sortColumnListUsingIndexes = function (indexes, colA, colB) {
        var indexA = indexes[colA.getId()];
        var indexB = indexes[colB.getId()];
        return indexA - indexB;
    };
    ColumnController.prototype.syncColumnWithNoState = function (column, source) {
        column.setVisible(false, source);
        column.setAggFunc(null);
        column.setPinned(null);
        column.setRowGroupActive(false, source);
        column.setPivotActive(false, source);
        column.setValueActive(false, source);
    };
    ColumnController.prototype.syncColumnWithStateItem = function (column, stateItem, rowGroupIndexes, pivotIndexes, source) {
        if (!column) {
            return;
        }
        // following ensures we are left with boolean true or false, eg converts (null, undefined, 0) all to true
        column.setVisible(!stateItem.hide, source);
        // sets pinned to 'left' or 'right'
        column.setPinned(stateItem.pinned);
        // if width provided and valid, use it, otherwise stick with the old width
        var minColWidth = this.gridOptionsWrapper.getMinColWidth();
        if (stateItem.flex != null) {
            column.setFlex(stateItem.flex);
            if (!this.flexActive && stateItem.flex) {
                this.flexActive = true;
            }
        }
        if (stateItem.width && minColWidth &&
            (stateItem.width >= minColWidth)) {
            column.setActualWidth(stateItem.width, source);
        }
        if (typeof stateItem.aggFunc === 'string') {
            column.setAggFunc(stateItem.aggFunc);
            column.setValueActive(true, source);
            this.valueColumns.push(column);
        }
        else {
            if (utils_1._.exists(stateItem.aggFunc)) {
                console.warn('ag-Grid: stateItem.aggFunc must be a string. if using your own aggregation ' +
                    'functions, register the functions first before using them in get/set state. This is because it is ' +
                    'intended for the column state to be stored and retrieved as simple JSON.');
            }
            column.setAggFunc(null);
            column.setValueActive(false, source);
        }
        if (typeof stateItem.rowGroupIndex === 'number') {
            this.rowGroupColumns.push(column);
            column.setRowGroupActive(true, source);
            rowGroupIndexes[column.getId()] = stateItem.rowGroupIndex;
        }
        else {
            column.setRowGroupActive(false, source);
        }
        if (typeof stateItem.pivotIndex === 'number') {
            this.pivotColumns.push(column);
            column.setPivotActive(true, source);
            pivotIndexes[column.getId()] = stateItem.pivotIndex;
        }
        else {
            column.setPivotActive(false, source);
        }
    };
    ColumnController.prototype.getGridColumns = function (keys) {
        return this.getColumns(keys, this.getGridColumn.bind(this));
    };
    ColumnController.prototype.getColumns = function (keys, columnLookupCallback) {
        var foundColumns = [];
        if (keys) {
            keys.forEach(function (key) {
                var column = columnLookupCallback(key);
                if (column) {
                    foundColumns.push(column);
                }
            });
        }
        return foundColumns;
    };
    // used by growGroupPanel
    ColumnController.prototype.getColumnWithValidation = function (key) {
        if (key == null) {
            return null;
        }
        var column = this.getGridColumn(key);
        if (!column) {
            console.warn('ag-Grid: could not find column ' + key);
        }
        return column;
    };
    ColumnController.prototype.getPrimaryColumn = function (key) {
        return this.getColumn(key, this.primaryColumns);
    };
    ColumnController.prototype.getGridColumn = function (key) {
        return this.getColumn(key, this.gridColumns);
    };
    ColumnController.prototype.getColumn = function (key, columnList) {
        if (!key) {
            return null;
        }
        for (var i = 0; i < columnList.length; i++) {
            if (this.columnsMatch(columnList[i], key)) {
                return columnList[i];
            }
        }
        return this.getAutoColumn(key);
    };
    ColumnController.prototype.getAutoColumn = function (key) {
        var _this = this;
        if (!this.groupAutoColumns ||
            !utils_1._.exists(this.groupAutoColumns) ||
            utils_1._.missing(this.groupAutoColumns)) {
            return null;
        }
        return utils_1._.find(this.groupAutoColumns, function (groupCol) { return _this.columnsMatch(groupCol, key); });
    };
    ColumnController.prototype.columnsMatch = function (column, key) {
        var columnMatches = column === key;
        var colDefMatches = column.getColDef() === key;
        var idMatches = column.getColId() == key;
        return columnMatches || colDefMatches || idMatches;
    };
    ColumnController.prototype.getDisplayNameForColumn = function (column, location, includeAggFunc) {
        if (includeAggFunc === void 0) { includeAggFunc = false; }
        if (!column) {
            return null;
        }
        var headerName = this.getHeaderName(column.getColDef(), column, null, null, location);
        if (includeAggFunc) {
            return this.wrapHeaderNameWithAggFunc(column, headerName);
        }
        return headerName;
    };
    ColumnController.prototype.getDisplayNameForOriginalColumnGroup = function (columnGroup, originalColumnGroup, location) {
        var colGroupDef = originalColumnGroup ? originalColumnGroup.getColGroupDef() : null;
        if (colGroupDef) {
            return this.getHeaderName(colGroupDef, null, columnGroup, originalColumnGroup, location);
        }
        return null;
    };
    ColumnController.prototype.getDisplayNameForColumnGroup = function (columnGroup, location) {
        return this.getDisplayNameForOriginalColumnGroup(columnGroup, columnGroup.getOriginalColumnGroup(), location);
    };
    // location is where the column is going to appear, ie who is calling us
    ColumnController.prototype.getHeaderName = function (colDef, column, columnGroup, originalColumnGroup, location) {
        var headerValueGetter = colDef.headerValueGetter;
        if (headerValueGetter) {
            var params = {
                colDef: colDef,
                column: column,
                columnGroup: columnGroup,
                originalColumnGroup: originalColumnGroup,
                location: location,
                api: this.gridOptionsWrapper.getApi(),
                context: this.gridOptionsWrapper.getContext()
            };
            if (typeof headerValueGetter === 'function') {
                // valueGetter is a function, so just call it
                return headerValueGetter(params);
            }
            else if (typeof headerValueGetter === 'string') {
                // valueGetter is an expression, so execute the expression
                return this.expressionService.evaluate(headerValueGetter, params);
            }
            console.warn('ag-grid: headerValueGetter must be a function or a string');
            return '';
        }
        else if (colDef.headerName != null) {
            return colDef.headerName;
        }
        else if (colDef.field) {
            return utils_1._.camelCaseToHumanText(colDef.field);
        }
        return '';
    };
    /*
        private getHeaderGroupName(columnGroup: ColumnGroup): string {
            let colGroupDef = columnGroup.getOriginalColumnGroup().getColGroupDef();
            let headerValueGetter = colGroupDef.headerValueGetter;

            if (headerValueGetter) {
                let params = {
                    columnGroup: columnGroup,
                    colDef: colGroupDef,
                    api: this.gridOptionsWrapper.getApi(),
                    context: this.gridOptionsWrapper.getContext()
                };

                if (typeof headerValueGetter === 'function') {
                    // valueGetter is a function, so just call it
                    return headerValueGetter(params);
                } else if (typeof headerValueGetter === 'string') {
                    // valueGetter is an expression, so execute the expression
                    return this.expressionService.evaluate(headerValueGetter, params);
                } else {
                    console.warn('ag-grid: headerValueGetter must be a function or a string');
                    return '';
                }
            } else {
                return colGroupDef.headerName;
            }
        }
    */
    ColumnController.prototype.wrapHeaderNameWithAggFunc = function (column, headerName) {
        if (this.gridOptionsWrapper.isSuppressAggFuncInHeader()) {
            return headerName;
        }
        // only columns with aggregation active can have aggregations
        var pivotValueColumn = column.getColDef().pivotValueColumn;
        var pivotActiveOnThisColumn = utils_1._.exists(pivotValueColumn);
        var aggFunc = null;
        var aggFuncFound;
        // otherwise we have a measure that is active, and we are doing aggregation on it
        if (pivotActiveOnThisColumn) {
            aggFunc = pivotValueColumn ? pivotValueColumn.getAggFunc() : null;
            aggFuncFound = true;
        }
        else {
            var measureActive = column.isValueActive();
            var aggregationPresent = this.pivotMode || !this.isRowGroupEmpty();
            if (measureActive && aggregationPresent) {
                aggFunc = column.getAggFunc();
                aggFuncFound = true;
            }
            else {
                aggFuncFound = false;
            }
        }
        if (aggFuncFound) {
            var aggFuncString = (typeof aggFunc === 'string') ? aggFunc : 'func';
            var localeTextFunc = this.gridOptionsWrapper.getLocaleTextFunc();
            var aggFuncStringTranslated = localeTextFunc(aggFuncString, aggFuncString);
            return aggFuncStringTranslated + "(" + headerName + ")";
        }
        return headerName;
    };
    // returns the group with matching colId and instanceId. If instanceId is missing,
    // matches only on the colId.
    ColumnController.prototype.getColumnGroup = function (colId, instanceId) {
        if (!colId) {
            return null;
        }
        if (colId instanceof columnGroup_1.ColumnGroup) {
            return colId;
        }
        var allColumnGroups = this.getAllDisplayedColumnGroups();
        var checkInstanceId = typeof instanceId === 'number';
        var result = null;
        this.columnUtils.depthFirstAllColumnTreeSearch(allColumnGroups, function (child) {
            if (child instanceof columnGroup_1.ColumnGroup) {
                var columnGroup = child;
                var matched = void 0;
                if (checkInstanceId) {
                    matched = colId === columnGroup.getGroupId() && instanceId === columnGroup.getInstanceId();
                }
                else {
                    matched = colId === columnGroup.getGroupId();
                }
                if (matched) {
                    result = columnGroup;
                }
            }
        });
        return result;
    };
    ColumnController.prototype.isReady = function () {
        return this.ready;
    };
    ColumnController.prototype.createValueColumns = function (source, oldPrimaryColumns) {
        this.valueColumns = this.extractColumns(oldPrimaryColumns, this.valueColumns, function (col, flag) { return col.setValueActive(flag, source); }, 
        // aggFunc doesn't have index variant, cos order of value cols doesn't matter, so always return null
        function () { return null; }, 
        // aggFunc is a string, so return it's existence
        function (colDef) { return !!colDef.aggFunc; });
        // all new columns added will have aggFunc missing, so set it to what is in the colDef
        this.valueColumns.forEach(function (col) {
            if (!col.getAggFunc()) {
                col.setAggFunc(col.getColDef().aggFunc);
            }
        });
    };
    ColumnController.prototype.extractRowGroupColumns = function (source, oldPrimaryColumns) {
        this.rowGroupColumns = this.extractColumns(oldPrimaryColumns, this.rowGroupColumns, function (col, flag) { return col.setRowGroupActive(flag, source); }, function (colDef) { return colDef.rowGroupIndex; }, function (colDef) { return colDef.rowGroup; });
    };
    ColumnController.prototype.extractColumns = function (oldPrimaryColumns, previousCols, setFlagFunc, getIndexFunc, getValueFunc) {
        var _this = this;
        if (!previousCols) {
            previousCols = [];
        }
        // remove cols that no longer exist
        var colPresentInPrimaryFunc = function (col) { return _this.primaryColumns.indexOf(col) >= 0; };
        var colMissingFromPrimaryFunc = function (col) { return _this.primaryColumns.indexOf(col) < 0; };
        var colNewFunc = function (col) { return !oldPrimaryColumns || oldPrimaryColumns.indexOf(col) < 0; };
        var removedCols = previousCols.filter(colMissingFromPrimaryFunc);
        var existingCols = previousCols.filter(colPresentInPrimaryFunc);
        var newPrimaryCols = this.primaryColumns.filter(colNewFunc);
        removedCols.forEach(function (col) { return setFlagFunc(col, false); });
        var newCols = [];
        // we only want to work on new columns, as old columns already got processed first time around
        // pull out items with xxxIndex
        newPrimaryCols.forEach(function (col) {
            var index = getIndexFunc(col.getColDef());
            if (typeof index === 'number') {
                newCols.push(col);
            }
        });
        // then sort them
        newCols.sort(function (colA, colB) {
            var indexA = getIndexFunc(colA.getColDef());
            var indexB = getIndexFunc(colB.getColDef());
            if (indexA === indexB) {
                return 0;
            }
            else if (indexA < indexB) {
                return -1;
            }
            return 1;
        });
        // now just pull out items xxx (boolean value), they will be added at the end
        // after the indexed ones, but in the order the columns appear
        newPrimaryCols.forEach(function (col) {
            var booleanValue = getValueFunc(col.getColDef());
            if (booleanValue) {
                // if user already specified xxxIndex then we skip it as this col already included
                if (newCols.indexOf(col) >= 0) {
                    return;
                }
                newCols.push(col);
            }
        });
        newCols.forEach(function (col) { return setFlagFunc(col, true); });
        var res = existingCols.concat(newCols);
        return res;
    };
    ColumnController.prototype.extractPivotColumns = function (source, oldPrimaryColumns) {
        this.pivotColumns = this.extractColumns(oldPrimaryColumns, this.pivotColumns, function (col, flag) { return col.setPivotActive(flag, source); }, function (colDef) { return colDef.pivotIndex; }, function (colDef) { return colDef.pivot; });
    };
    ColumnController.prototype.resetColumnGroupState = function (source) {
        if (source === void 0) { source = "api"; }
        var stateItems = [];
        this.columnUtils.depthFirstOriginalTreeSearch(null, this.primaryColumnTree, function (child) {
            if (child instanceof originalColumnGroup_1.OriginalColumnGroup) {
                var groupState = {
                    groupId: child.getGroupId(),
                    open: child.getColGroupDef().openByDefault
                };
                stateItems.push(groupState);
            }
        });
        this.setColumnGroupState(stateItems, source);
    };
    ColumnController.prototype.getColumnGroupState = function () {
        var columnGroupState = [];
        this.columnUtils.depthFirstOriginalTreeSearch(null, this.gridBalancedTree, function (node) {
            if (node instanceof originalColumnGroup_1.OriginalColumnGroup) {
                var originalColumnGroup = node;
                columnGroupState.push({
                    groupId: originalColumnGroup.getGroupId(),
                    open: originalColumnGroup.isExpanded()
                });
            }
        });
        return columnGroupState;
    };
    ColumnController.prototype.setColumnGroupState = function (stateItems, source) {
        var _this = this;
        if (source === void 0) { source = "api"; }
        this.columnAnimationService.start();
        var impactedGroups = [];
        stateItems.forEach(function (stateItem) {
            var groupKey = stateItem.groupId;
            var newValue = stateItem.open;
            var originalColumnGroup = _this.getOriginalColumnGroup(groupKey);
            if (!originalColumnGroup) {
                return;
            }
            if (originalColumnGroup.isExpanded() === newValue) {
                return;
            }
            _this.logger.log('columnGroupOpened(' + originalColumnGroup.getGroupId() + ',' + newValue + ')');
            originalColumnGroup.setExpanded(newValue);
            impactedGroups.push(originalColumnGroup);
        });
        this.updateGroupsAndDisplayedColumns(source);
        this.setFirstRightAndLastLeftPinned(source);
        impactedGroups.forEach(function (originalColumnGroup) {
            var event = {
                type: events_1.Events.EVENT_COLUMN_GROUP_OPENED,
                columnGroup: originalColumnGroup,
                api: _this.gridApi,
                columnApi: _this.columnApi
            };
            _this.eventService.dispatchEvent(event);
        });
        this.columnAnimationService.finish();
    };
    // called by headerRenderer - when a header is opened or closed
    ColumnController.prototype.setColumnGroupOpened = function (key, newValue, source) {
        if (source === void 0) { source = "api"; }
        var keyAsString;
        if (key instanceof originalColumnGroup_1.OriginalColumnGroup) {
            keyAsString = key.getId();
        }
        else {
            keyAsString = key;
        }
        this.setColumnGroupState([{ groupId: keyAsString, open: newValue }], source);
    };
    ColumnController.prototype.getOriginalColumnGroup = function (key) {
        if (key instanceof originalColumnGroup_1.OriginalColumnGroup) {
            return key;
        }
        if (typeof key !== 'string') {
            console.error('ag-Grid: group key must be a string');
        }
        // otherwise, search for the column group by id
        var res = null;
        this.columnUtils.depthFirstOriginalTreeSearch(null, this.gridBalancedTree, function (node) {
            if (node instanceof originalColumnGroup_1.OriginalColumnGroup) {
                var originalColumnGroup = node;
                if (originalColumnGroup.getId() === key) {
                    res = originalColumnGroup;
                }
            }
        });
        return res;
    };
    ColumnController.prototype.calculateColumnsForDisplay = function () {
        var _this = this;
        var columnsForDisplay;
        if (this.pivotMode && !this.secondaryColumnsPresent) {
            // pivot mode is on, but we are not pivoting, so we only
            // show columns we are aggregating on
            columnsForDisplay = this.gridColumns.filter(function (column) {
                var isAutoGroupCol = _this.groupAutoColumns && utils_1._.includes(_this.groupAutoColumns, column);
                var isValueCol = _this.valueColumns && utils_1._.includes(_this.valueColumns, column);
                return isAutoGroupCol || isValueCol;
            });
        }
        else {
            // otherwise continue as normal. this can be working on the primary
            // or secondary columns, whatever the gridColumns are set to
            columnsForDisplay = this.gridColumns.filter(function (column) {
                // keep col if a) it's auto-group or b) it's visible
                var isAutoGroupCol = _this.groupAutoColumns && utils_1._.includes(_this.groupAutoColumns, column);
                return isAutoGroupCol || column.isVisible();
            });
        }
        return columnsForDisplay;
    };
    ColumnController.prototype.checkColSpanActiveInCols = function (columns) {
        var result = false;
        columns.forEach(function (col) {
            if (utils_1._.exists(col.getColDef().colSpan)) {
                result = true;
            }
        });
        return result;
    };
    ColumnController.prototype.calculateColumnsForGroupDisplay = function () {
        var _this = this;
        this.groupDisplayColumns = [];
        var checkFunc = function (col) {
            var colDef = col.getColDef();
            if (colDef && utils_1._.exists(colDef.showRowGroup)) {
                _this.groupDisplayColumns.push(col);
            }
        };
        this.gridColumns.forEach(checkFunc);
        if (this.groupAutoColumns) {
            this.groupAutoColumns.forEach(checkFunc);
        }
    };
    ColumnController.prototype.getGroupDisplayColumns = function () {
        return this.groupDisplayColumns;
    };
    ColumnController.prototype.updateDisplayedColumns = function (source) {
        var columnsForDisplay = this.calculateColumnsForDisplay();
        this.buildDisplayedTrees(columnsForDisplay);
        this.calculateColumnsForGroupDisplay();
        // also called when group opened/closed
        this.updateGroupsAndDisplayedColumns(source);
        // also called when group opened/closed
        this.setFirstRightAndLastLeftPinned(source);
    };
    ColumnController.prototype.isSecondaryColumnsPresent = function () {
        return this.secondaryColumnsPresent;
    };
    ColumnController.prototype.setSecondaryColumns = function (colDefs, source) {
        if (source === void 0) { source = "api"; }
        var newColsPresent = colDefs && colDefs.length > 0;
        // if not cols passed, and we had to cols anyway, then do nothing
        if (!newColsPresent && !this.secondaryColumnsPresent) {
            return;
        }
        if (newColsPresent) {
            this.processSecondaryColumnDefinitions(colDefs);
            var balancedTreeResult = this.columnFactory.createColumnTree(colDefs, false);
            this.secondaryBalancedTree = balancedTreeResult.columnTree;
            this.secondaryHeaderRowCount = balancedTreeResult.treeDept + 1;
            this.secondaryColumns = this.getColumnsFromTree(this.secondaryBalancedTree);
            this.secondaryColumnsPresent = true;
        }
        else {
            this.secondaryBalancedTree = null;
            this.secondaryHeaderRowCount = -1;
            this.secondaryColumns = null;
            this.secondaryColumnsPresent = false;
        }
        this.updateGridColumns();
        this.updateDisplayedColumns(source);
    };
    ColumnController.prototype.processSecondaryColumnDefinitions = function (colDefs) {
        var columnCallback = this.gridOptionsWrapper.getProcessSecondaryColDefFunc();
        var groupCallback = this.gridOptionsWrapper.getProcessSecondaryColGroupDefFunc();
        if (!columnCallback && !groupCallback) {
            return undefined;
        }
        var searchForColDefs = function (colDefs2) {
            colDefs2.forEach(function (abstractColDef) {
                var isGroup = utils_1._.exists(abstractColDef.children);
                if (isGroup) {
                    var colGroupDef = abstractColDef;
                    if (groupCallback) {
                        groupCallback(colGroupDef);
                    }
                    searchForColDefs(colGroupDef.children);
                }
                else {
                    var colDef = abstractColDef;
                    if (columnCallback) {
                        columnCallback(colDef);
                    }
                }
            });
        };
        if (colDefs) {
            searchForColDefs(colDefs);
        }
    };
    // called from: setColumnState, setColumnDefs, setSecondaryColumns
    ColumnController.prototype.updateGridColumns = function () {
        if (this.gridColsArePrimary) {
            this.lastPrimaryOrder = this.gridColumns;
        }
        if (this.secondaryColumns && this.secondaryBalancedTree) {
            this.gridBalancedTree = this.secondaryBalancedTree.slice();
            this.gridHeaderRowCount = this.secondaryHeaderRowCount;
            this.gridColumns = this.secondaryColumns.slice();
            this.gridColsArePrimary = false;
        }
        else {
            this.gridBalancedTree = this.primaryColumnTree.slice();
            this.gridHeaderRowCount = this.primaryHeaderRowCount;
            this.gridColumns = this.primaryColumns.slice();
            this.gridColsArePrimary = true;
            // updateGridColumns gets called after user adds a row group. we want to maintain the order of the columns
            // when this happens (eg if user moved a column) rather than revert back to the original column order.
            // likewise if changing in/out of pivot mode, we want to maintain the order of the primary cols
            this.orderGridColsLikeLastPrimary();
        }
        this.addAutoGroupToGridColumns();
        this.autoRowHeightColumns = this.gridColumns.filter(function (col) { return col.getColDef().autoHeight; });
        this.putFixedColumnsFirst();
        this.setupQuickFilterColumns();
        this.clearDisplayedColumns();
        this.colSpanActive = this.checkColSpanActiveInCols(this.gridColumns);
        var event = {
            type: events_1.Events.EVENT_GRID_COLUMNS_CHANGED,
            api: this.gridApi,
            columnApi: this.columnApi
        };
        this.eventService.dispatchEvent(event);
    };
    ColumnController.prototype.orderGridColsLikeLastPrimary = function () {
        var _this = this;
        if (utils_1._.missing(this.lastPrimaryOrder)) {
            return;
        }
        // only do the sort if at least one column is accounted for. columns will be not accounted for
        // if changing from secondary to primary columns
        var noColsFound = true;
        this.gridColumns.forEach(function (col) {
            if (_this.lastPrimaryOrder.indexOf(col) >= 0) {
                noColsFound = false;
            }
        });
        if (noColsFound) {
            return;
        }
        // order cols in the same order as before. we need to make sure that all
        // cols still exists, so filter out any that no longer exist.
        var oldColsOrdered = this.lastPrimaryOrder.filter(function (col) { return _this.gridColumns.indexOf(col) >= 0; });
        var newColsOrdered = this.gridColumns.filter(function (col) { return oldColsOrdered.indexOf(col) < 0; });
        // add in the new columns, at the end (if no group), or at the end of the group (if a group)
        var newGridColumns = oldColsOrdered.slice();
        newColsOrdered.forEach(function (newCol) {
            var parent = newCol.getOriginalParent();
            // if no parent, means we are not grouping, so just add the column to the end
            if (!parent) {
                newGridColumns.push(newCol);
                return;
            }
            // find the group the column belongs to. if no siblings at the current level (eg col in group on it's
            // own) then go up one level and look for siblings there.
            var siblings = [];
            while (!siblings.length && parent) {
                var leafCols = parent.getLeafColumns();
                leafCols.forEach(function (leafCol) {
                    var presentInNewGriColumns = newGridColumns.indexOf(leafCol) >= 0;
                    var noYetInSiblings = siblings.indexOf(leafCol) < 0;
                    if (presentInNewGriColumns && noYetInSiblings) {
                        siblings.push(leafCol);
                    }
                });
                parent = parent.getOriginalParent();
            }
            // if no siblings exist at any level, this means the col is in a group (or parent groups) on it's own
            if (!siblings.length) {
                newGridColumns.push(newCol);
                return;
            }
            // find index of last column in the group
            var indexes = siblings.map(function (col) { return newGridColumns.indexOf(col); });
            var lastIndex = Math.max.apply(Math, indexes);
            utils_1._.insertIntoArray(newGridColumns, newCol, lastIndex + 1);
        });
        this.gridColumns = newGridColumns;
    };
    ColumnController.prototype.isPrimaryColumnGroupsPresent = function () {
        return this.primaryHeaderRowCount > 1;
    };
    // if we are using autoGroupCols, then they should be included for quick filter. this covers the
    // following scenarios:
    // a) user provides 'field' into autoGroupCol of normal grid, so now because a valid col to filter leafs on
    // b) using tree data and user depends on autoGroupCol for first col, and we also want to filter on this
    //    (tree data is a bit different, as parent rows can be filtered on, unlike row grouping)
    ColumnController.prototype.setupQuickFilterColumns = function () {
        if (this.groupAutoColumns) {
            this.columnsForQuickFilter = this.primaryColumns.concat(this.groupAutoColumns);
        }
        else {
            this.columnsForQuickFilter = this.primaryColumns;
        }
    };
    ColumnController.prototype.putFixedColumnsFirst = function () {
        var locked = this.gridColumns.filter(function (c) { return c.getColDef().lockPosition; });
        var unlocked = this.gridColumns.filter(function (c) { return !c.getColDef().lockPosition; });
        this.gridColumns = locked.concat(unlocked);
    };
    ColumnController.prototype.addAutoGroupToGridColumns = function () {
        // add in auto-group here
        this.createGroupAutoColumnsIfNeeded();
        if (utils_1._.missing(this.groupAutoColumns)) {
            return;
        }
        this.gridColumns = this.groupAutoColumns ? this.groupAutoColumns.concat(this.gridColumns) : this.gridColumns;
        var autoColBalancedTree = this.columnFactory.createForAutoGroups(this.groupAutoColumns, this.gridBalancedTree);
        this.gridBalancedTree = autoColBalancedTree.concat(this.gridBalancedTree);
    };
    // gets called after we copy down grid columns, to make sure any part of the gui
    // that tries to draw, eg the header, it will get empty lists of columns rather
    // than stale columns. for example, the header will received gridColumnsChanged
    // event, so will try and draw, but it will draw successfully when it acts on the
    // virtualColumnsChanged event
    ColumnController.prototype.clearDisplayedColumns = function () {
        this.displayedLeftColumnTree = [];
        this.displayedRightColumnTree = [];
        this.displayedCentreColumnTree = [];
        this.displayedLeftHeaderRows = {};
        this.displayedRightHeaderRows = {};
        this.displayedCentreHeaderRows = {};
        this.displayedLeftColumns = [];
        this.displayedRightColumns = [];
        this.displayedCenterColumns = [];
        this.allDisplayedColumns = [];
        this.allDisplayedVirtualColumns = [];
    };
    ColumnController.prototype.updateGroupsAndDisplayedColumns = function (source) {
        this.updateOpenClosedVisibilityInColumnGroups();
        this.updateDisplayedColumnsFromTrees(source);
        this.updateVirtualSets();
        this.refreshFlexedColumns(undefined, undefined, true);
        this.updateBodyWidths();
        // this event is picked up by the gui, headerRenderer and rowRenderer, to recalculate what columns to display
        var event = {
            type: events_1.Events.EVENT_DISPLAYED_COLUMNS_CHANGED,
            api: this.gridApi,
            columnApi: this.columnApi
        };
        this.eventService.dispatchEvent(event);
    };
    ColumnController.prototype.updateDisplayedColumnsFromTrees = function (source) {
        this.addToDisplayedColumns(this.displayedLeftColumnTree, this.displayedLeftColumns);
        this.addToDisplayedColumns(this.displayedCentreColumnTree, this.displayedCenterColumns);
        this.addToDisplayedColumns(this.displayedRightColumnTree, this.displayedRightColumns);
        this.setupAllDisplayedColumns();
        this.setLeftValues(source);
    };
    ColumnController.prototype.setupAllDisplayedColumns = function () {
        if (this.gridOptionsWrapper.isEnableRtl()) {
            this.allDisplayedColumns = this.displayedRightColumns
                .concat(this.displayedCenterColumns)
                .concat(this.displayedLeftColumns);
        }
        else {
            this.allDisplayedColumns = this.displayedLeftColumns
                .concat(this.displayedCenterColumns)
                .concat(this.displayedRightColumns);
        }
    };
    // sets the left pixel position of each column
    ColumnController.prototype.setLeftValues = function (source) {
        this.setLeftValuesOfColumns(source);
        this.setLeftValuesOfGroups();
    };
    ColumnController.prototype.setLeftValuesOfColumns = function (source) {
        var _this = this;
        // go through each list of displayed columns
        var allColumns = this.primaryColumns.slice(0);
        // let totalColumnWidth = this.getWidthOfColsInList()
        var doingRtl = this.gridOptionsWrapper.isEnableRtl();
        [
            this.displayedLeftColumns,
            this.displayedRightColumns,
            this.displayedCenterColumns
        ].forEach(function (columns) {
            if (doingRtl) {
                // when doing RTL, we start at the top most pixel (ie RHS) and work backwards
                var left_1 = _this.getWidthOfColsInList(columns);
                columns.forEach(function (column) {
                    left_1 -= column.getActualWidth();
                    column.setLeft(left_1, source);
                });
            }
            else {
                // otherwise normal LTR, we start at zero
                var left_2 = 0;
                columns.forEach(function (column) {
                    column.setLeft(left_2, source);
                    left_2 += column.getActualWidth();
                });
            }
            utils_1._.removeAllFromArray(allColumns, columns);
        });
        // items left in allColumns are columns not displayed, so remove the left position. this is
        // important for the rows, as if a col is made visible, then taken out, then made visible again,
        // we don't want the animation of the cell floating in from the old position, whatever that was.
        allColumns.forEach(function (column) {
            column.setLeft(null, source);
        });
    };
    ColumnController.prototype.setLeftValuesOfGroups = function () {
        // a groups left value is the lest left value of it's children
        [
            this.displayedLeftColumnTree,
            this.displayedRightColumnTree,
            this.displayedCentreColumnTree
        ].forEach(function (columns) {
            columns.forEach(function (column) {
                if (column instanceof columnGroup_1.ColumnGroup) {
                    var columnGroup = column;
                    columnGroup.checkLeft();
                }
            });
        });
    };
    ColumnController.prototype.addToDisplayedColumns = function (displayedColumnTree, displayedColumns) {
        displayedColumns.length = 0;
        this.columnUtils.depthFirstDisplayedColumnTreeSearch(displayedColumnTree, function (child) {
            if (child instanceof column_1.Column) {
                displayedColumns.push(child);
            }
        });
    };
    ColumnController.prototype.updateDisplayedCenterVirtualColumns = function () {
        if (this.suppressColumnVirtualisation) {
            // no virtualisation, so don't filter
            this.allDisplayedCenterVirtualColumns = this.displayedCenterColumns;
        }
        else {
            // filter out what should be visible
            this.allDisplayedCenterVirtualColumns = this.filterOutColumnsWithinViewport();
        }
        this.allDisplayedVirtualColumns = this.allDisplayedCenterVirtualColumns
            .concat(this.displayedLeftColumns)
            .concat(this.displayedRightColumns);
        // return map of virtual col id's, for easy lookup when building the groups.
        // the map will be colId=>true, ie col id's mapping to 'true'.
        var result = {};
        this.allDisplayedVirtualColumns.forEach(function (col) {
            result[col.getId()] = true;
        });
        return result;
    };
    ColumnController.prototype.getVirtualHeaderGroupRow = function (type, dept) {
        var result;
        switch (type) {
            case constants_1.Constants.PINNED_LEFT:
                result = this.displayedLeftHeaderRows[dept];
                break;
            case constants_1.Constants.PINNED_RIGHT:
                result = this.displayedRightHeaderRows[dept];
                break;
            default:
                result = this.displayedCentreHeaderRows[dept];
                break;
        }
        if (utils_1._.missing(result)) {
            result = [];
        }
        return result;
    };
    ColumnController.prototype.updateDisplayedVirtualGroups = function (virtualColIds) {
        // go through each group, see if any of it's cols are displayed, and if yes,
        // then this group is included
        this.displayedLeftHeaderRows = {};
        this.displayedRightHeaderRows = {};
        this.displayedCentreHeaderRows = {};
        var testGroup = function (children, result, dept) {
            var returnValue = false;
            for (var i = 0; i < children.length; i++) {
                // see if this item is within viewport
                var child = children[i];
                var addThisItem = void 0;
                if (child instanceof column_1.Column) {
                    // for column, test if column is included
                    addThisItem = virtualColIds[child.getId()] === true;
                }
                else {
                    // if group, base decision on children
                    var columnGroup = child;
                    addThisItem = testGroup(columnGroup.getDisplayedChildren(), result, dept + 1);
                }
                if (addThisItem) {
                    returnValue = true;
                    if (!result[dept]) {
                        result[dept] = [];
                    }
                    result[dept].push(child);
                }
            }
            return returnValue;
        };
        testGroup(this.displayedLeftColumnTree, this.displayedLeftHeaderRows, 0);
        testGroup(this.displayedRightColumnTree, this.displayedRightHeaderRows, 0);
        testGroup(this.displayedCentreColumnTree, this.displayedCentreHeaderRows, 0);
    };
    ColumnController.prototype.updateVirtualSets = function () {
        var virtualColIds = this.updateDisplayedCenterVirtualColumns();
        this.updateDisplayedVirtualGroups(virtualColIds);
    };
    ColumnController.prototype.filterOutColumnsWithinViewport = function () {
        return this.displayedCenterColumns.filter(this.isColumnInViewport.bind(this));
    };
    ColumnController.prototype.refreshFlexedColumns = function (updatedFlexViewportWidth, source, silent) {
        if (source === void 0) { source = 'flex'; }
        if (!this.flexActive) {
            return;
        }
        this.flexViewportWidth = updatedFlexViewportWidth || this.flexViewportWidth;
        if (!this.flexViewportWidth) {
            return;
        }
        // If the grid has left-over space, divide it between flexing columns in proportion to their flex value.
        // A "flexing column" is one that has a 'flex' value set and is not currently being constrained by its
        // minWidth or maxWidth rules.
        var knownWidthColumns = this.displayedCenterColumns.filter(function (col) { return !col.getFlex(); });
        var flexingColumns = this.displayedCenterColumns.filter(function (col) { return col.getFlex(); });
        if (!flexingColumns.length) {
            this.flexActive = false;
            return;
        }
        var flexingColumnSizes = [];
        var spaceForFlexingColumns;
        outer: while (true) {
            var totalFlex = flexingColumns.reduce(function (count, col) { return count + col.getFlex(); }, 0);
            spaceForFlexingColumns = this.flexViewportWidth - this.getWidthOfColsInList(knownWidthColumns);
            for (var i = 0; i < flexingColumns.length; i++) {
                var col = flexingColumns[i];
                var widthByFlexRule = spaceForFlexingColumns * col.getFlex() / totalFlex;
                var constrainedWidth = void 0;
                if (widthByFlexRule < col.getMinWidth()) {
                    constrainedWidth = col.getMinWidth();
                }
                else if (col.getMaxWidth() != null && widthByFlexRule > col.getMaxWidth()) {
                    constrainedWidth = col.getMaxWidth();
                }
                if (constrainedWidth) {
                    // This column is not in fact flexing as it is being constrained to a specific size
                    // so remove it from the list of flexing columns and start again
                    col.setActualWidth(constrainedWidth, source);
                    utils_1._.removeFromArray(flexingColumns, col);
                    knownWidthColumns.push(col);
                    continue outer;
                }
                flexingColumnSizes[i] = Math.round(widthByFlexRule);
            }
            break;
        }
        var remainingSpace = spaceForFlexingColumns;
        flexingColumns.forEach(function (col, i) {
            col.setActualWidth(Math.min(flexingColumnSizes[i], remainingSpace), source);
            remainingSpace -= flexingColumnSizes[i];
        });
        this.setLeftValues(source);
        if (!silent) {
            this.updateBodyWidths();
            this.fireResizedEventForColumns(flexingColumns, source);
        }
    };
    // called from api
    ColumnController.prototype.sizeColumnsToFit = function (gridWidth, source, silent) {
        if (source === void 0) { source = "sizeColumnsToFit"; }
        // avoid divide by zero
        var allDisplayedColumns = this.getAllDisplayedColumns();
        if (gridWidth <= 0 || !allDisplayedColumns.length) {
            return;
        }
        var colsToSpread = [];
        var colsToNotSpread = [];
        allDisplayedColumns.forEach(function (column) {
            if (column.getColDef().suppressSizeToFit === true) {
                colsToNotSpread.push(column);
            }
            else {
                colsToSpread.push(column);
            }
        });
        // make a copy of the cols that are going to be resized
        var colsToFireEventFor = colsToSpread.slice(0);
        var finishedResizing = false;
        var moveToNotSpread = function (column) {
            utils_1._.removeFromArray(colsToSpread, column);
            colsToNotSpread.push(column);
        };
        // resetting cols to their original width makes the sizeColumnsToFit more deterministic,
        // rather than depending on the current size of the columns. most users call sizeColumnsToFit
        // immediately after grid is created, so will make no difference. however if application is calling
        // sizeColumnsToFit repeatedly (eg after column group is opened / closed repeatedly) we don't want
        // the columns to start shrinking / growing over time.
        colsToSpread.forEach(function (column) { return column.resetActualWidth(); });
        while (!finishedResizing) {
            finishedResizing = true;
            var availablePixels = gridWidth - this.getWidthOfColsInList(colsToNotSpread);
            if (availablePixels <= 0) {
                // no width, set everything to minimum
                colsToSpread.forEach(function (column) {
                    column.setMinimum(source);
                });
            }
            else {
                var scale = availablePixels / this.getWidthOfColsInList(colsToSpread);
                // we set the pixels for the last col based on what's left, as otherwise
                // we could be a pixel or two short or extra because of rounding errors.
                var pixelsForLastCol = availablePixels;
                // backwards through loop, as we are removing items as we go
                for (var i = colsToSpread.length - 1; i >= 0; i--) {
                    var column = colsToSpread[i];
                    var newWidth = Math.round(column.getActualWidth() * scale);
                    if (newWidth < column.getMinWidth()) {
                        column.setMinimum(source);
                        moveToNotSpread(column);
                        finishedResizing = false;
                    }
                    else if (column.isGreaterThanMax(newWidth)) {
                        column.setActualWidth(column.getMaxWidth(), source);
                        moveToNotSpread(column);
                        finishedResizing = false;
                    }
                    else {
                        var onLastCol = i === 0;
                        if (onLastCol) {
                            column.setActualWidth(pixelsForLastCol, source);
                        }
                        else {
                            column.setActualWidth(newWidth, source);
                        }
                    }
                    pixelsForLastCol -= newWidth;
                }
            }
        }
        this.setLeftValues(source);
        this.updateBodyWidths();
        if (silent) {
            return;
        }
        this.fireResizedEventForColumns(colsToFireEventFor, source);
    };
    ColumnController.prototype.fireResizedEventForColumns = function (columns, source) {
        var _this = this;
        columns.forEach(function (column) {
            var event = {
                type: events_1.Events.EVENT_COLUMN_RESIZED,
                column: column,
                columns: [column],
                finished: true,
                api: _this.gridApi,
                columnApi: _this.columnApi,
                source: source
            };
            _this.eventService.dispatchEvent(event);
        });
    };
    ColumnController.prototype.buildDisplayedTrees = function (visibleColumns) {
        var leftVisibleColumns = [];
        var rightVisibleColumns = [];
        var centerVisibleColumns = [];
        visibleColumns.forEach(function (column) {
            switch (column.getPinned()) {
                case "left":
                    leftVisibleColumns.push(column);
                    break;
                case "right":
                    rightVisibleColumns.push(column);
                    break;
                default:
                    centerVisibleColumns.push(column);
                    break;
            }
        });
        var groupInstanceIdCreator = new groupInstanceIdCreator_1.GroupInstanceIdCreator();
        this.displayedLeftColumnTree = this.displayedGroupCreator.createDisplayedGroups(leftVisibleColumns, this.gridBalancedTree, groupInstanceIdCreator, constants_1.Constants.PINNED_LEFT, this.displayedLeftColumnTree);
        this.displayedRightColumnTree = this.displayedGroupCreator.createDisplayedGroups(rightVisibleColumns, this.gridBalancedTree, groupInstanceIdCreator, constants_1.Constants.PINNED_RIGHT, this.displayedRightColumnTree);
        this.displayedCentreColumnTree = this.displayedGroupCreator.createDisplayedGroups(centerVisibleColumns, this.gridBalancedTree, groupInstanceIdCreator, null, this.displayedCentreColumnTree);
    };
    ColumnController.prototype.updateOpenClosedVisibilityInColumnGroups = function () {
        var allColumnGroups = this.getAllDisplayedColumnGroups();
        this.columnUtils.depthFirstAllColumnTreeSearch(allColumnGroups, function (child) {
            if (child instanceof columnGroup_1.ColumnGroup) {
                var columnGroup = child;
                columnGroup.calculateDisplayedColumns();
            }
        });
    };
    ColumnController.prototype.getGroupAutoColumns = function () {
        return this.groupAutoColumns;
    };
    ColumnController.prototype.createGroupAutoColumnsIfNeeded = function () {
        if (!this.autoGroupsNeedBuilding) {
            return;
        }
        this.autoGroupsNeedBuilding = false;
        var groupFullWidthRow = this.gridOptionsWrapper.isGroupUseEntireRow(this.pivotMode);
        // we need to allow suppressing auto-column separately for group and pivot as the normal situation
        // is CSRM and user provides group column themselves for normal view, but when they go into pivot the
        // columns are generated by the grid so no opportunity for user to provide group column. so need a way
        // to suppress auto-col for grouping only, and not pivot.
        // however if using Viewport RM or SSRM and user is providing the columns, the user may wish full control
        // of the group column in this instance.
        var suppressAutoColumn = this.pivotMode ?
            this.gridOptionsWrapper.isPivotSuppressAutoColumn() : this.gridOptionsWrapper.isGroupSuppressAutoColumn();
        // const groupSuppressAutoColumn = this.gridOptionsWrapper.isGroupSuppressAutoColumn() && !this.pivotMode;
        var groupSuppressRow = this.gridOptionsWrapper.isGroupSuppressRow();
        var groupingActive = this.rowGroupColumns.length > 0 || this.usingTreeData;
        var needAutoColumns = groupingActive && !suppressAutoColumn && !groupFullWidthRow && !groupSuppressRow;
        if (needAutoColumns) {
            var newAutoGroupCols = this.autoGroupColService.createAutoGroupColumns(this.rowGroupColumns);
            var autoColsDifferent = !this.autoColsEqual(newAutoGroupCols, this.groupAutoColumns);
            // we force recreate when suppressSetColumnStateEvents changes, so new group cols pick up the new
            // definitions. otherwise we could ignore the new cols becasue they appear to be the same.
            if (autoColsDifferent || this.forceRecreateAutoGroups) {
                this.groupAutoColumns = newAutoGroupCols;
            }
        }
        else {
            this.groupAutoColumns = null;
        }
    };
    ColumnController.prototype.autoColsEqual = function (colsA, colsB) {
        return array_1.areEqual(colsA, colsB, function (a, b) { return a.getColId() === b.getColId(); });
    };
    ColumnController.prototype.getWidthOfColsInList = function (columnList) {
        return columnList.reduce(function (width, col) { return width + col.getActualWidth(); }, 0);
    };
    ColumnController.prototype.getGridBalancedTree = function () {
        return this.gridBalancedTree;
    };
    ColumnController.prototype.hasFloatingFilters = function () {
        var defaultColDef = this.gridOptionsWrapper.getDefaultColDef();
        return (defaultColDef != null && defaultColDef.floatingFilter === true) ||
            (this.columnDefs != null && this.columnDefs.some(function (c) { return c.floatingFilter === true; }));
    };
    ColumnController.prototype.getFirstDisplayedColumn = function () {
        var isRtl = this.gridOptionsWrapper.isEnableRtl();
        var queryOrder = [
            'getDisplayedLeftColumns',
            'getDisplayedCenterColumns',
            'getDisplayedRightColumns'
        ];
        if (isRtl) {
            queryOrder.reverse();
        }
        for (var i = 0; i < queryOrder.length; i++) {
            var container = this[queryOrder[i]]();
            if (container.length) {
                return isRtl ? utils_1._.last(container) : container[0];
            }
        }
        return null;
    };
    __decorate([
        context_1.Autowired('gridOptionsWrapper')
    ], ColumnController.prototype, "gridOptionsWrapper", void 0);
    __decorate([
        context_1.Autowired('expressionService')
    ], ColumnController.prototype, "expressionService", void 0);
    __decorate([
        context_1.Autowired('columnFactory')
    ], ColumnController.prototype, "columnFactory", void 0);
    __decorate([
        context_1.Autowired('displayedGroupCreator')
    ], ColumnController.prototype, "displayedGroupCreator", void 0);
    __decorate([
        context_1.Autowired('autoWidthCalculator')
    ], ColumnController.prototype, "autoWidthCalculator", void 0);
    __decorate([
        context_1.Autowired('columnUtils')
    ], ColumnController.prototype, "columnUtils", void 0);
    __decorate([
        context_1.Autowired('columnAnimationService')
    ], ColumnController.prototype, "columnAnimationService", void 0);
    __decorate([
        context_1.Autowired('autoGroupColService')
    ], ColumnController.prototype, "autoGroupColService", void 0);
    __decorate([
        context_1.Optional('aggFuncService')
    ], ColumnController.prototype, "aggFuncService", void 0);
    __decorate([
        context_1.Optional('valueCache')
    ], ColumnController.prototype, "valueCache", void 0);
    __decorate([
        context_1.Optional('animationFrameService')
    ], ColumnController.prototype, "animationFrameService", void 0);
    __decorate([
        context_1.Autowired('columnApi')
    ], ColumnController.prototype, "columnApi", void 0);
    __decorate([
        context_1.Autowired('gridApi')
    ], ColumnController.prototype, "gridApi", void 0);
    __decorate([
        context_1.PostConstruct
    ], ColumnController.prototype, "init", null);
    __decorate([
        __param(0, context_1.Qualifier('loggerFactory'))
    ], ColumnController.prototype, "setBeans", null);
    ColumnController = __decorate([
        context_1.Bean('columnController')
    ], ColumnController);
    return ColumnController;
}(beanStub_1.BeanStub));
exports.ColumnController = ColumnController;

//# sourceMappingURL=columnController.js.map
