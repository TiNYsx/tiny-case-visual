import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const CaseEditionPage = () => {
  const [cases, setCases] = useState([]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const newCases = [...cases];
    const [reorderedCase] = newCases.splice(result.source.index, 1);
    newCases.splice(result.destination.index, 0, reorderedCase);
    setCases(newCases);
  };

  return (
    <div style={{ height: '100vh', overflowY: 'auto' }}>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="cases">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} style={{ maxHeight: '100vh', overflowY: 'auto' }}>
              {cases.map((caseItem, index) => (
                <Draggable key={caseItem.id} draggableId={caseItem.id} index={index}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ maxHeight: '100vh', overflowY: 'auto' }}>
                      <CaseItem case={caseItem} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default CaseEditionPage;
