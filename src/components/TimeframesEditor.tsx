import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';

type Slot = {
  start: number; // minutes since midnight (0-1439)
  end: number;   // minutes since midnight (0-1439)
};

// Helper functions
function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function normalizeAndFill(slots: Slot[]): Slot[] {
  // Sort by start time
  slots.sort((a, b) => a.start - b.start);

  // Merge overlapping slots (but keep adjacent windows separate)
  const merged: Slot[] = [];
  for (const s of slots) {
    if (!merged.length) {
      merged.push({ ...s });
    } else {
      const last = merged[merged.length - 1];
      if (s.start <= last.end) {
        last.end = Math.max(last.end, s.end);
        continue;
      }
      merged.push({ ...s });
    }
  }
  
  // Fill gaps
  const filled: Slot[] = [];
  let cursor = 0;
  for (const m of merged) {
    if (cursor < m.start) {
      filled.push({ start: cursor, end: m.start - 1 });
    }
    filled.push(m);
    cursor = m.end + 1;
  }
  if (cursor <= 1439) {
    filled.push({ start: cursor, end: 1439 });
  }
  
  return filled;
}

function deleteAndMerge(slots: Slot[], idx: number): Slot[] {
  const newSlots = [...slots];
  const removed = newSlots.splice(idx, 1)[0];

  if (!removed) {
    return normalizeAndFill(newSlots);
  }

  const prevIdx = idx - 1;
  const prev = prevIdx >= 0 ? newSlots[prevIdx] : undefined;
  const next = newSlots[idx];

  if (prev && next) {
    // Merge neighboring slots into one continuous block
    const mergedSlot: Slot = { start: prev.start, end: next.end };
    newSlots.splice(prevIdx, 2, mergedSlot);
  } else if (prev) {
    // Extend previous slot to the end of the day
    prev.end = 1439;
  } else if (next) {
    // Extend next slot to the beginning of the day
    next.start = 0;
  }

  return normalizeAndFill(newSlots);
}

function applyEdit(
  slots: Slot[],
  idx: number,
  newStart?: number,
  newEnd?: number
): Slot[] {
  const newSlots = [...slots];
  const s = newSlots[idx];
  
  if (newStart !== undefined) {
    s.start = Math.max(0, Math.min(newStart, s.end));
  }
  if (newEnd !== undefined) {
    s.end = Math.min(1439, Math.max(newEnd, s.start));
  }
  
  // Adjust neighbors
  const prev = newSlots[idx - 1];
  const next = newSlots[idx + 1];
  if (prev) prev.end = Math.max(prev.start, s.start - 1);
  if (next) next.start = Math.min(next.end, s.end + 1);
  
  return normalizeAndFill(newSlots);
}

function splitSlot(slots: Slot[], idx: number, splitStart: number, splitEnd: number): Slot[] {
  const newSlots = [...slots];
  const original = newSlots[idx];

  // Validate split stays within bounds and has at least one minute
  if (splitStart < original.start || splitEnd > original.end || splitStart > splitEnd) {
    return slots;
  }

  const result: Slot[] = [];

  if (original.start < splitStart) {
    result.push({ start: original.start, end: splitStart - 1 });
  }

  result.push({ start: splitStart, end: splitEnd });

  if (splitEnd < original.end) {
    result.push({ start: splitEnd + 1, end: original.end });
  }

  newSlots.splice(idx, 1, ...result);

  return normalizeAndFill(newSlots);
}

function validateTimeInput(value: string): boolean {
  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!regex.test(value)) return false;
  const mins = minutes(value);
  return mins >= 0 && mins <= 1439;
}

export function TimeframesEditor() {
  const [slots, setSlots] = useState<Slot[]>([{ start: 0, end: 1439 }]);
  const [savedSlots, setSavedSlots] = useState<Slot[]>([{ start: 0, end: 1439 }]);
  const [editingSlot, setEditingSlot] = useState<{
    idx: number;
    startValue: string;
    endValue: string;
    startValid: boolean;
    endValid: boolean;
  } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [addDialog, setAddDialog] = useState<{
    slotIndex: number;
    startValue: string;
    endValue: string;
    startValid: boolean;
    endValid: boolean;
  } | null>(null);

  useEffect(() => {
    const changed = JSON.stringify(slots) !== JSON.stringify(savedSlots);
    setHasUnsavedChanges(changed);
  }, [slots, savedSlots]);

  const handleDelete = (idx: number) => {
    if (slots.length === 1) return; // Prevent deleting the last slot
    const newSlots = deleteAndMerge(slots, idx);
    setSlots(newSlots);
  };

  const handleStartEdit = (idx: number) => {
    const slot = slots[idx];
    setEditingSlot({
      idx,
      startValue: hhmm(slot.start),
      endValue: hhmm(slot.end),
      startValid: true,
      endValid: true,
    });
  };

  const handleEditChange = (field: 'start' | 'end', value: string) => {
    if (!editingSlot) return;
    
    const valid = validateTimeInput(value);
    
    setEditingSlot({
      ...editingSlot,
      [`${field}Value`]: value,
      [`${field}Valid`]: valid,
    });
  };

  const handleSaveEdit = () => {
    if (!editingSlot || !editingSlot.startValid || !editingSlot.endValid) return;
    
    const newStart = minutes(editingSlot.startValue);
    const newEnd = minutes(editingSlot.endValue);
    
    if (newStart > newEnd) return; // Invalid range
    
    const newSlots = applyEdit(slots, editingSlot.idx, newStart, newEnd);
    setSlots(newSlots);
    setEditingSlot(null);
  };

  const handleCancelEdit = () => {
    setEditingSlot(null);
  };

  const getDefaultRangeForSlot = (slot: Slot) => {
    const slotSize = slot.end - slot.start + 1;
    const duration = Math.min(60, Math.max(1, Math.floor(slotSize / 3)));
    const start = slot.start + Math.floor((slotSize - duration) / 2);
    const clampedStart = Math.min(start, slot.end - duration + 1);
    const end = clampedStart + duration - 1;
    return { start: clampedStart, end };
  };

  const openAddDialog = (slotIndex: number) => {
    const slot = slots[slotIndex];
    if (!slot) return;
    const defaults = getDefaultRangeForSlot(slot);
    setAddDialog({
      slotIndex,
      startValue: hhmm(defaults.start),
      endValue: hhmm(defaults.end),
      startValid: true,
      endValid: true,
    });
  };

  const handleAddTimeframe = () => {
    if (!slots.length) return;
    let largestIdx = 0;
    let largestSize = slots[0].end - slots[0].start;

    for (let i = 1; i < slots.length; i++) {
      const size = slots[i].end - slots[i].start;
      if (size > largestSize) {
        largestSize = size;
        largestIdx = i;
      }
    }

    openAddDialog(largestIdx);
  };

  const handleAddDialogInputChange = (field: 'start' | 'end', value: string) => {
    setAddDialog(prev => {
      if (!prev) return prev;

      const next = {
        ...prev,
        startValue: field === 'start' ? value : prev.startValue,
        endValue: field === 'end' ? value : prev.endValue,
      };

      const startFormatValid = validateTimeInput(next.startValue);
      const endFormatValid = validateTimeInput(next.endValue);
      const startMinutes = startFormatValid ? minutes(next.startValue) : null;
      const endMinutes = endFormatValid ? minutes(next.endValue) : null;

      let slotIndex = prev.slotIndex;
      let slotBoundsValid = true;

      if (startMinutes !== null || endMinutes !== null) {
        const candidateIndex = slots.findIndex(slot => {
          const coversStart = startMinutes === null || (startMinutes >= slot.start && startMinutes <= slot.end);
          const coversEnd = endMinutes === null || (endMinutes >= slot.start && endMinutes <= slot.end);
          return coversStart && coversEnd;
        });
        if (candidateIndex !== -1) {
          slotIndex = candidateIndex;
        } else {
          slotBoundsValid = false;
        }
      }

      const slot = slots[slotIndex];
      let startValid = startFormatValid;
      let endValid = endFormatValid;

      if (slot) {
        if (startMinutes !== null) {
          startValid = startValid && startMinutes >= slot.start && startMinutes <= slot.end;
        }
        if (endMinutes !== null) {
          endValid = endValid && endMinutes >= slot.start && endMinutes <= slot.end;
        }
      } else {
        startValid = false;
        endValid = false;
      }

      if (!slotBoundsValid) {
        if (field === 'start') startValid = false;
        if (field === 'end') endValid = false;
      }

      return {
        ...next,
        slotIndex,
        startValid,
        endValid,
      };
    });
  };

  const handleAddDialogCancel = () => setAddDialog(null);

  const handleAddDialogConfirm = () => {
    if (!addDialog) return;
    const slot = slots[addDialog.slotIndex];
    if (!slot) return;

    const startValid = addDialog.startValid && validateTimeInput(addDialog.startValue);
    const endValid = addDialog.endValid && validateTimeInput(addDialog.endValue);
    if (!startValid || !endValid) return;

    const startMinutes = minutes(addDialog.startValue);
    const endMinutes = minutes(addDialog.endValue);

    if (startMinutes < slot.start || endMinutes > slot.end || startMinutes > endMinutes) {
      return;
    }

    const newSlots = splitSlot(slots, addDialog.slotIndex, startMinutes, endMinutes);
    setSlots(newSlots);
    setAddDialog(null);
  };

  const handleSave = () => {
    setSavedSlots([...slots]);
    setHasUnsavedChanges(false);
    // Here you could call an API: PUT /api/timeframes
    console.log('Saved timeframes:', slots.map(s => ({ start: hhmm(s.start), end: hhmm(s.end) })));
  };

  const handleCancel = () => {
    setSlots([...savedSlots]);
    setEditingSlot(null);
    setHasUnsavedChanges(false);
  };

  const handleCreate = () => {
    handleSave();
    // Additional create logic if needed
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Card className="max-w-3xl mx-auto p-6 bg-white shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Edit Timeframes</h1>
          {hasUnsavedChanges && (
            <span className="text-sm text-amber-600 font-medium">Unsaved changes</span>
          )}
        </div>

        <div className="mb-4">
          <Button
            onClick={handleAddTimeframe}
            variant="outline"
            className="w-full sm:w-auto"
          >
            + Zeitfenster hinzufügen
          </Button>
        </div>

        <div className="space-y-2 mb-6">
          <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-2 items-center text-sm font-medium text-gray-600 mb-2">
            <div>Timeframe</div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>

          {slots.map((slot, idx) => (
            <div
              key={`${slot.start}-${slot.end}-${idx}`}
              className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-2 items-center"
            >
              {editingSlot?.idx === idx ? (
                <>
                  <Input
                    type="text"
                    value={editingSlot.startValue}
                    onChange={(e) => handleEditChange('start', e.target.value)}
                    placeholder="00:00"
                    className={`text-center ${!editingSlot.startValid ? 'border-red-500' : ''}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <span className="text-gray-500">-</span>
                  <Input
                    type="text"
                    value={editingSlot.endValue}
                    onChange={(e) => handleEditChange('end', e.target.value)}
                    placeholder="23:59"
                    className={`text-center ${!editingSlot.endValid ? 'border-red-500' : ''}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <Button
                    onClick={handleSaveEdit}
                    disabled={!editingSlot.startValid || !editingSlot.endValid}
                    size="sm"
                    className="bg-blue-700 hover:bg-blue-800"
                  >
                    Save
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    type="text"
                    value={hhmm(slot.start)}
                    readOnly
                    onClick={() => handleStartEdit(idx)}
                    className="text-center cursor-pointer bg-gray-50 hover:bg-gray-100"
                  />
                  <span className="text-gray-500">-</span>
                  <Input
                    type="text"
                    value={hhmm(slot.end)}
                    readOnly
                    onClick={() => handleStartEdit(idx)}
                    className="text-center cursor-pointer bg-gray-50 hover:bg-gray-100"
                  />
                  <div className="w-[80px]"></div>
                  <Button
                    onClick={() => handleDelete(idx)}
                    variant="outline"
                    size="sm"
                    disabled={slots.length === 1}
                    className="hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <Button
            onClick={handleCancel}
            variant="outline"
            disabled={!hasUnsavedChanges}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            className="bg-blue-700 hover:bg-blue-800"
            disabled={!hasUnsavedChanges}
          >
            Create
          </Button>
        </div>

        {addDialog && slots[addDialog.slotIndex] && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Neues Zeitfenster</h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Das neue Zeitfenster wird automatisch innerhalb des größten verfügbaren Fensters angelegt. Zeiten können angepasst werden.
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Start</label>
                    <Input
                      value={addDialog.startValue}
                      onChange={(e) => handleAddDialogInputChange('start', e.target.value)}
                      placeholder="HH:MM"
                      className={`text-center ${!addDialog.startValid ? 'border-red-500 focus:border-red-500' : ''}`}
                    />
                  </div>
                  <span className="text-gray-500 text-sm">–</span>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Ende</label>
                    <Input
                      value={addDialog.endValue}
                      onChange={(e) => handleAddDialogInputChange('end', e.target.value)}
                      placeholder="HH:MM"
                      className={`text-center ${!addDialog.endValid ? 'border-red-500 focus:border-red-500' : ''}`}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Zielbereich: {hhmm(slots[addDialog.slotIndex].start)} – {hhmm(slots[addDialog.slotIndex].end)}
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={handleAddDialogCancel}>
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleAddDialogConfirm}
                    disabled={!(addDialog.startValid && addDialog.endValid && minutes(addDialog.startValue) <= minutes(addDialog.endValue))}
                    className="bg-blue-700 hover:bg-blue-800"
                  >
                    Erstellen
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug info */}
        <div className="mt-8 p-4 bg-gray-100 rounded text-xs font-mono">
          <div className="font-semibold mb-2">Current State:</div>
          <pre>{JSON.stringify(slots.map(s => ({ start: hhmm(s.start), end: hhmm(s.end) })), null, 2)}</pre>
        </div>
      </Card>
    </div>
  );
}
