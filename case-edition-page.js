import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Scrollbar } from 'react-scrollbars';

const CaseEditionPage = () => {
  const [cases, setCases] = useState([]);
  const [scrollable, setScrollable] = useState(false);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const newCases = [...cases];
    const [reorderedCase] = newCases.splice(result.source.index, 1);
    newCases.splice(result.destination.index, 0, reorderedCase);
    setCases(newCases);
  };

  return (
    <div style={{ height: '80vh', overflowY: 'auto' }}>
      <Scrollbar>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="cases">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {cases.map((caseItem, index) => (
                  <Draggable key={caseItem.id} draggableId={caseItem.id} index={index}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
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
      </Scrollbar>
    </div>
  );
};

export default CaseEditionPage;
