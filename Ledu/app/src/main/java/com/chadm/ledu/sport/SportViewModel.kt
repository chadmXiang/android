package com.chadm.ledu.sport

import android.app.Application
import android.content.ContentUris
import android.net.Uri
import android.provider.DocumentsContract
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.json.JSONArray

class SportViewModel(app: Application) : AndroidViewModel(app) {

    private val dao = SportDatabase.get(app).sportDao()

    val workouts: StateFlow<List<WorkoutEntity>> =
        dao.workoutsFlow().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun workout(logId: String): Flow<WorkoutEntity?> = dao.workoutFlow(logId)

    fun splits(logId: String): Flow<List<SplitEntity>> = dao.splitsFlow(logId)

    /** Live GPS recorder; survives rotation because it lives here. */
    val recorder = WorkoutRecorder(app, viewModelScope)

    /** Stops the recorder and persists the workout (no-op if not recording). */
    fun stopAndSaveWorkout() {
        val result = recorder.stop() ?: return
        viewModelScope.launch(Dispatchers.IO) {
            dao.replaceWorkout(result.workout, result.splits)
        }
    }

    /** Import progress published to the UI. */
    data class ImportState(
        val running: Boolean = false,
        val found: Int = 0,
        val imported: Int = 0,
        val failed: Int = 0,
        val done: Boolean = false,
    )

    private val _importState = MutableStateFlow(ImportState())
    val importState: StateFlow<ImportState> = _importState

    /**
     * Walks the picked SAF tree, parses every .json, upserts by logId
     * (re-import is idempotent). Runs on Dispatchers.IO.
     */
    fun importFromTree(treeUri: Uri) {
        if (_importState.value.running) return
        _importState.value = ImportState(running = true)
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val resolver = getApplication<Application>().contentResolver
                val files = mutableListOf<Pair<String, Uri>>()
                val stack = ArrayDeque<String>()
                stack.addLast(DocumentsContract.getTreeDocumentId(treeUri))
                while (stack.isNotEmpty()) {
                    val docId = stack.removeLast()
                    val childrenUri =
                        DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, docId)
                    val cursor = resolver.query(
                        childrenUri,
                        arrayOf(
                            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                            DocumentsContract.Document.COLUMN_MIME_TYPE,
                            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                        ),
                        null, null, null,
                    ) ?: continue
                    cursor.use { c ->
                        while (c.moveToNext()) {
                            val childId = c.getString(0) ?: continue
                            val mime = c.getString(1) ?: ""
                            val name = c.getString(2) ?: ""
                            if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
                                stack.addLast(childId)
                            } else if (name.endsWith(".json", ignoreCase = true)) {
                                files.add(
                                    name to DocumentsContract.buildDocumentUriUsingTree(
                                        treeUri, childId,
                                    ),
                                )
                            }
                        }
                    }
                }
                _importState.value = _importState.value.copy(found = files.size)
                var imported = 0
                var failed = 0
                for ((name, uri) in files) {
                    try {
                        val text = resolver.openInputStream(uri)?.bufferedReader()?.use {
                            it.readText()
                        }
                        val parsed = text?.let { KeepLogParser.parse(it, name) }
                        if (parsed != null) {
                            dao.replaceWorkout(parsed.workout, parsed.splits)
                            imported++
                        } else {
                            failed++
                        }
                    } catch (e: Exception) {
                        failed++
                    }
                    _importState.value = _importState.value.copy(imported = imported, failed = failed)
                }
                _importState.value = _importState.value.copy(running = false, done = true)
            } catch (e: Exception) {
                _importState.value = _importState.value.copy(running = false, done = true)
            }
        }
    }

    fun resetImportState() {
        _importState.value = ImportState()
    }
}

/** Decode trackJson "[[lat,lon,alt,tsec],...]" (null-safe). */
fun parseTrack(trackJson: String?): List<DoubleArray>? {
    if (trackJson == null) return null
    return try {
        val arr = JSONArray(trackJson)
        List(arr.length()) { i ->
            val p = arr.getJSONArray(i)
            doubleArrayOf(p.optDouble(0), p.optDouble(1), p.optDouble(2), p.optDouble(3))
        }
    } catch (e: Exception) {
        null
    }
}
