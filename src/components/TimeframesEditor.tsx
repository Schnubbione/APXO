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
  
  // Merge adjacent/overlapping slots
  const merged: Slot[] = [];
  for (const s of slots) {
    if (!merged.length) {
      merged.push({ ...s });
    } else {
      const last = merged[merged.length - 1];
      if (s.start <= last.end + 1) {
        last.end = Math.max(last.end, s.end);
      } else {
        merged.push({ ...s });
      }
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
  newSlots.splice(idx, 1);
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
  if (prev) prev.end = s.start - 1;
  if (next) next.start = s.end + 1;
  
  return normalizeAndFill(newSlots);
}

function splitSlot(slots: Slot[], idx: number, splitStart: number, splitEnd: number): Slot[] {
  const newSlots = [...slots];
  const original = newSlots[idx];
  
  console.log('splitSlot called:', { original, splitStart, splitEnd });
  
  // Validate split is within bounds and makes sense
  if (splitStart <= original.start || splitEnd >= original.end || splitStart >= splitEnd) {
    console.log('Split validation failed:', { 
      startCheck: splitStart <= original.start,
      endCheck: splitEnd >= original.end,
      orderCheck: splitStart >= splitEnd
    });
    return slots; // Invalid split
  }
  
  const result: Slot[] = [];
  
  // Left part (if any)
  if (original.start < splitStart) {
    result.push({ start: original.start, end: splitStart - 1 });
  }
  
  // New slot
  result.push({ start: splitStart, end: splitEnd });
  
  // Right part (if any)
  if (splitEnd < original.end) {
    result.push({ start: splitEnd + 1, end: original.end });
  }
  
  console.log('Split result:', result);
  
  // Replace original slot with new parts
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
    
    if (newStart >= newEnd) return; // Invalid range
    
    const newSlots = applyEdit(slots, editingSlot.idx, newStart, newEnd);
    setSlots(newSlots);
    setEditingSlot(null);
  };

  const handleCancelEdit = () => {
    setEditingSlot(null);
  };

  const handleAddTimeframe = () => {
    // Find the largest slot and split it in half
    let largestIdx = 0;
    let largestSize = slots[0].end - slots[0].start;
    
    for (let i = 1; i < slots.length; i++) {
      const size = slots[i].end - slots[i].start;
      if (size > largestSize) {
        largestSize = size;
        largestIdx = i;
      }
    }
    
    const slot = slots[largestIdx];
    const slotSize = slot.end - slot.start + 1; // +1 because end is inclusive
    
    // Only split if slot is at least 3 minutes (so we can make 3 parts: left, middle, right)
    if (slotSize < 3) {
      console.log('Cannot split: slot too small', { slotSize });
      return;
    }
    
    // Calculate split points - create a new slot roughly 1 hour (or 1/3 of the slot) in the middle
    const newSlotDuration = Math.min(60, Math.floor(slotSize / 3));
    const mid = Math.floor((slot.start + slot.end) / 2);
    const splitStart = Math.max(slot.start + 1, mid - Math.floor(newSlotDuration / 2));
    const splitEnd = Math.min(slot.end - 1, splitStart + newSlotDuration - 1);
    
    console.log('Splitting slot:', { slot, slotSize, splitStart, splitEnd, largestIdx, newSlotDuration });
    
    const newSlots = splitSlot(slots, largestIdx, splitStart, splitEnd);
    console.log('New slots after split:', newSlots);
    setSlots(newSlots);
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

        {/* Debug info */}
        <div className="mt-8 p-4 bg-gray-100 rounded text-xs font-mono">
          <div className="font-semibold mb-2">Current State:</div>
          <pre>{JSON.stringify(slots.map(s => ({ start: hhmm(s.start), end: hhmm(s.end) })), null, 2)}</pre>
        </div>
      </Card>
    </div>
  );
}
